import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getAvatarUrl, PaginatedResultDto, SortOrder } from '../../../common';
import { CacheKeys, CacheService, PubSubService } from '../../redis';
import { StorageService } from '../../storage/storage.service';
import {
  LeaderboardEntryDto,
  LeaderboardProblemStatus,
  ProblemStatusDto,
} from '../dto';
import {
  ContestParticipant,
  ContestProblem,
  ProblemScore,
  Contest,
} from '../entities';
import {
  ILeaderboardEntry,
  ILeaderboardUpdateEvent,
  RawLeaderboardEntry,
} from '../interfaces';
import { SystemConfigService } from '../../system-config/system-config.service';
import { ContestService } from './contest.service';
import { SubmissionStatus } from '../../submissions/enums';

/** Cache TTL for leaderboard (30 seconds for near-real-time) */
const LEADERBOARD_CACHE_TTL = 30;

@Injectable()
export class ContestLeaderboardService {
  private readonly logger = new Logger(ContestLeaderboardService.name);

  constructor(
    @InjectRepository(ContestParticipant)
    private readonly participantRepository: Repository<ContestParticipant>,
    @InjectRepository(ContestProblem)
    private readonly contestProblemRepository: Repository<ContestProblem>,
    private readonly contestService: ContestService,
    private readonly cacheService: CacheService,
    private readonly pubSubService: PubSubService,
    private readonly storageService: StorageService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * Get leaderboard for a contest with pagination
   */
  async getLeaderboard(
    contestId: number,
    page: number = 1,
    limit: number = 50,
    search?: string,
  ): Promise<PaginatedResultDto<LeaderboardEntryDto>> {
    const cacheKey = CacheKeys.contest.leaderboard(
      contestId,
      page,
      limit,
      search,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const skip = (page - 1) * limit;

        // Use raw query for Window Functions to handle ranking correctly across pages
        const queryBuilder = this.participantRepository
          .createQueryBuilder('p')
          .leftJoinAndSelect('p.user', 'u')
          .select('p.userId', 'userId')
          .addSelect('p.totalScore', 'totalScore')
          .addSelect('p.solvedCount', 'solvedCount')
          .addSelect('p.finishTime', 'finishTime')
          .addSelect('p.problemScores', 'problemScores')
          .addSelect('u.username', 'username')
          .addSelect('u.avatarKey', 'avatarKey')
          .addSelect('u.fullName', 'fullName')
          .addSelect(
            'DENSE_RANK() OVER (ORDER BY p.solved_count DESC, p.total_score DESC, p.finish_time ASC)',
            'rank',
          )
          .where('p.contestId = :contestId', { contestId })
          .orderBy('p.solvedCount', 'DESC')
          .addOrderBy('p.totalScore', 'DESC')
          .addOrderBy('p.finishTime', 'ASC')
          .offset(skip)
          .limit(limit);

        if (search) {
          queryBuilder.andWhere(
            '(u.username ILIKE :search OR u.fullName ILIKE :search)',
            { search: `%${search}%` },
          );
        }

        const rawData = await queryBuilder.getRawMany<RawLeaderboardEntry>();
        const total = await this.participantRepository.count({
          where: { contestId },
        });

        const contestProblems = await this.contestProblemRepository.find({
          where: { contestId },
          order: { orderIndex: SortOrder.ASC },
        });

        const data: LeaderboardEntryDto[] = rawData.map((row) => {
          // Parse problem scores from jsonb
          const problemScoresMap = row.problemScores || {};
          const problemStatus: ProblemStatusDto[] = contestProblems.map(
            (cp) => {
              const ps = problemScoresMap[cp.problemId] ?? {
                score: 0,
                submissions: 0,
                lastSubmitTime: null,
                firstAcTime: null,
              };

              let status = LeaderboardProblemStatus.NOT_STARTED;
              if (ps.firstAcTime) {
                status = LeaderboardProblemStatus.SOLVED;
              } else if (ps.submissions > 0) {
                status = LeaderboardProblemStatus.ATTEMPTED;
              }

              return {
                problemId: cp.problemId,
                problemOrder: cp.orderIndex,
                status,
                score: ps.score,
                attempts: ps.submissions,
              };
            },
          );

          return {
            rank: parseInt(row.rank, 10),
            user: {
              id: row.userId,
              username: row.username ?? 'Unknown',
              avatarUrl:
                getAvatarUrl(row.avatarKey, this.storageService) ?? undefined,
              fullName: row.fullName ?? undefined,
            },
            totalScore: parseFloat(row.totalScore),
            problemStatus,
          } as LeaderboardEntryDto;
        });

        return new PaginatedResultDto(data, { page, limit, total });
      },
      { ttl: LEADERBOARD_CACHE_TTL },
    );
  }

  /**
   * Update participant score after a submission is judged
   * IOI Scoring: Score = Base Points - (Time to AC / Contest Duration) × Base Points × Decay Rate
   * Only keeps the best score per problem
   */
  async updateParticipantScore(
    contestId: number,
    userId: number,
    problemId: number,
    submissionStatus: SubmissionStatus,
  ): Promise<void> {
    // Optimization: Only fetch contest/problem if needed for score calculation
    const isAccepted = submissionStatus === SubmissionStatus.ACCEPTED;
    let contest, contestProblem;

    if (isAccepted) {
      [contest, contestProblem] = await Promise.all([
        this.contestService.getContestById(contestId),
        this.contestProblemRepository.findOne({
          where: { contestId, problemId },
        }),
      ]);

      if (!contestProblem) {
        this.logger.warn(
          `Problem ${problemId} not found in contest ${contestId}`,
        );
        return;
      }
    }

    const maxRetries = this.systemConfigService.getInt(
      'LEADERBOARD_UPDATE_RETRIES',
      3,
    );
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const participant = await this.participantRepository.findOne({
          where: { contestId, userId },
        });

        if (!participant) throw new Error('Participant not found');

        const now = new Date();
        let scoreToApply = 0;

        if (isAccepted && contest && contestProblem) {
          scoreToApply = this.calculateDecayedScore(
            contest,
            contestProblem,
            now,
          );
        }

        this.applyParticipantUpdate(
          participant,
          problemId,
          isAccepted,
          scoreToApply,
          now,
          contest,
        );

        await this.participantRepository.save(participant);

        this.logger.debug(
          `Updated participant ${userId}: Score=${participant.totalScore}, Solved=${participant.solvedCount}`,
        );
        break;
      } catch (error: unknown) {
        attempt++;
        if (!this.handleRetryError(error, attempt, maxRetries, userId)) {
          throw error;
        }
        await new Promise((res) => setTimeout(res, 50));
      }
    }

    // Post-update: Cache & Notify
    await this.invalidateLeaderboardCache(contestId);
    const entry = await this.getParticipantStanding(contestId, userId);
    if (entry) {
      await this.publishLeaderboardUpdate(contestId, entry);
    }
  }

  /**
   * Calculate IOI-style score with time decay
   */
  private calculateDecayedScore(
    contest: Contest,
    problem: ContestProblem,
    submissionTime: Date,
  ): number {
    const startTime = contest.startTime;
    const durationMinutes = contest.durationMinutes;
    const baseScore = problem.points;

    if (durationMinutes <= 0 || baseScore <= 0) return baseScore;

    const decayRate = this.systemConfigService.getFloat(
      'CONTEST_DECAY_RATE',
      0,
    );
    const timeTakenMs = Math.max(
      0,
      submissionTime.getTime() - startTime.getTime(),
    );
    const timeTakenMinutes = timeTakenMs / 60000;

    const decayFactor = (timeTakenMinutes / durationMinutes) * decayRate;
    const penalty = baseScore * Math.min(decayFactor, 1);

    return Math.round(Math.max(0, baseScore - penalty) * 100) / 100;
  }

  /**
   * Apply updates to participant state
   */
  private applyParticipantUpdate(
    participant: ContestParticipant,
    problemId: number,
    isAccepted: boolean,
    newScore: number,
    now: Date,
    contest?: Contest,
  ): void {
    // 1. Global Stats
    participant.totalSubmissions += 1;
    participant.lastSubmissionAt = now;

    // 2. Problem Stats
    const currentScore = participant.problemScores[problemId] ?? {
      score: 0,
      submissions: 0,
      lastSubmitTime: null,
      firstAcTime: null,
    };

    const updatedScore: ProblemScore = {
      ...currentScore,
      submissions: currentScore.submissions + 1,
      lastSubmitTime: now.toISOString(),
    };

    if (isAccepted) {
      updatedScore.score = Math.max(newScore, currentScore.score);
      if (!updatedScore.firstAcTime) {
        updatedScore.firstAcTime = now.toISOString();
      }
    }

    participant.problemScores = {
      ...participant.problemScores,
      [problemId]: updatedScore,
    };

    // 3. Recalculate Aggregates (Only if Accepted and contest provided)
    if (isAccepted && contest) {
      const scores = Object.values(participant.problemScores);
      participant.totalScore = scores.reduce((sum, ps) => sum + ps.score, 0);
      participant.solvedCount = scores.filter(
        (ps) => ps.firstAcTime != null,
      ).length;

      let totalFinishTimeMs = 0;
      scores.forEach((ps) => {
        if (ps.firstAcTime) {
          const acTime = new Date(ps.firstAcTime).getTime();
          const timeTaken = Math.max(0, acTime - contest.startTime.getTime());
          totalFinishTimeMs += timeTaken;
        }
      });
      participant.finishTime = totalFinishTimeMs;
    }
  }

  /**
   * Helper to handle retry logic
   */
  private handleRetryError(
    error: unknown,
    attempt: number,
    maxRetries: number,
    userId: number,
  ): boolean {
    const err = error as Error & { name?: string };
    if (err.name === 'OptimisticLockVersionMismatchError') {
      if (attempt >= maxRetries) {
        this.logger.error(
          `Failed to update score for user ${userId} after ${maxRetries} attempts`,
          error,
        );
        return false;
      }
      this.logger.warn(
        `Optimistic lock mismatch for user ${userId}, retrying... (Attempt ${attempt})`,
      );
      return true;
    }
    return false;
  }

  /**
   * Calculate IOI-style score
   */
  private calculateScore(
    passedTestcases: number,
    totalTestcases: number,
    problemPoints: number,
  ): number {
    if (totalTestcases === 0) return 0;
    return (
      Math.round((passedTestcases / totalTestcases) * problemPoints * 100) / 100
    );
  }

  /**
   * Get a single participant's current standing
   */
  async getParticipantStanding(
    contestId: number,
    userId: number,
  ): Promise<LeaderboardEntryDto | null> {
    const participant = await this.participantRepository.findOne({
      where: { contestId, userId },
      relations: ['user'],
    });

    if (!participant) {
      return null;
    }

    // Get contest problems
    const contestProblems = await this.contestProblemRepository.find({
      where: { contestId },
      order: { orderIndex: SortOrder.ASC },
    });

    // Build problem scores with status
    const problemStatus: ProblemStatusDto[] = contestProblems.map((cp) => {
      const ps = participant.problemScores[cp.problemId] ?? {
        score: 0,
        submissions: 0,
        lastSubmitTime: null,
        firstAcTime: null,
      };

      let status = LeaderboardProblemStatus.NOT_STARTED;
      if (ps.firstAcTime) {
        status = LeaderboardProblemStatus.SOLVED;
      } else if (ps.submissions > 0) {
        status = LeaderboardProblemStatus.ATTEMPTED;
      }

      return {
        problemId: cp.problemId,
        problemOrder: cp.orderIndex,
        status,
        score: ps.score,
        attempts: ps.submissions,
      };
    });

    // Calculate rank dynamically
    const rank = await this.participantRepository
      .createQueryBuilder('p')
      .where('p.contestId = :contestId', { contestId })
      .andWhere(
        '(p.solvedCount > :solvedCount OR (p.solvedCount = :solvedCount AND p.totalScore > :totalScore) OR (p.solvedCount = :solvedCount AND p.totalScore = :totalScore AND p.finishTime < :finishTime))',
        {
          solvedCount: participant.solvedCount,
          totalScore: participant.totalScore,
          finishTime: participant.finishTime,
        },
      )
      .getCount();

    return {
      rank: rank + 1,
      user: {
        id: participant.userId,
        username: participant.user?.username ?? 'Unknown',
        avatarUrl:
          getAvatarUrl(participant.user?.avatarKey, this.storageService) ??
          undefined,
        fullName: participant.user?.fullName,
      },
      totalScore: Number(participant.totalScore),
      problemStatus,
    };
  }

  /**
   * Publish leaderboard update event for SSE
   */
  async publishLeaderboardUpdate(
    contestId: number,
    entry: LeaderboardEntryDto,
  ): Promise<void> {
    const channel = `contest:${contestId}:leaderboard`;
    const event: ILeaderboardUpdateEvent = {
      contestId,
      entry: entry as unknown as ILeaderboardEntry,
      timestamp: Date.now(),
    };

    await this.pubSubService.publish(channel, JSON.stringify(event));
    this.logger.debug(
      `Published leaderboard update for contest ${contestId}, user ${entry.user.id}`,
    );
  }

  /**
   * Invalidate leaderboard cache
   */
  async invalidateLeaderboardCache(contestId: number): Promise<void> {
    await this.cacheService.invalidateByPattern(
      CacheKeys.contest.leaderboardPattern(contestId),
    );
  }
}
