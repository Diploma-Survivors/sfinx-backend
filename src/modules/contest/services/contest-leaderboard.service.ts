import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResultDto, SortOrder } from '../../../common';
import { getAvatarUrl } from '../../../common';
import { CacheService } from '../../redis';
import { PubSubService } from '../../redis';
import { StorageService } from '../../storage/storage.service';
import { CacheKeys } from '../../redis';
import {
  LeaderboardEntryDto,
  LeaderboardProblemStatus,
  ProblemStatusDto,
} from '../dto';
import { ContestParticipant, ProblemScore } from '../entities';
import { ContestProblem } from '../entities';
import {
  ILeaderboardEntry,
  ILeaderboardUpdateEvent,
  RawLeaderboardEntry,
} from '../interfaces';
import { SystemConfigService } from '../../system-config/system-config.service';
import { ContestService } from './contest.service';

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
  ): Promise<void> {
    const contest = await this.contestService.getContestById(contestId);

    const contestProblem = await this.contestProblemRepository.findOne({
      where: { contestId, problemId },
    });

    if (!contestProblem) {
      this.logger.warn(
        `Problem ${problemId} not found in contest ${contestId}`,
      );
      return;
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

        if (!participant) {
          throw new Error('Participant not found');
        }

        // --- IOI + Time Scoring Logic ---
        const now = new Date();
        const startTime = contest.startTime;
        const durationMinutes = contest.durationMinutes;

        // Base Score
        const baseScore = contestProblem.points;

        // Apply Time Decay
        // Score = Base * (1 - (Time / Duration) * DecayRate)
        const decayRate = this.systemConfigService.getFloat(
          'CONTEST_DECAY_RATE',
          0,
        );
        const timeTakenMs = Math.max(0, now.getTime() - startTime.getTime());
        const timeTakenMinutes = timeTakenMs / 60000;

        let finalProblemScore = baseScore;
        if (durationMinutes > 0 && baseScore > 0) {
          const decayFactor = (timeTakenMinutes / durationMinutes) * decayRate;
          // Ensure penalty doesn't exceed base score or make it negative
          const penalty = baseScore * Math.min(decayFactor, 1);
          finalProblemScore = Math.max(0, baseScore - penalty);
          finalProblemScore = Math.round(finalProblemScore * 100) / 100;
        }

        // Get existing score
        const currentProblemScore = participant.problemScores[problemId] ?? {
          score: 0,
          submissions: 0,
          lastSubmitTime: null,
          firstAcTime: null,
        };

        // Update Logic: Keep Max Score
        const newProblemScore: ProblemScore = {
          score: Math.max(finalProblemScore, currentProblemScore.score),
          submissions: currentProblemScore.submissions + 1,
          lastSubmitTime: now.toISOString(),
          firstAcTime: currentProblemScore.firstAcTime,
        };

        // If AC (Full Score) and no previous AC -> Set firstAcTime
        // This method is now only called for AC submissions
        if (!currentProblemScore.firstAcTime) {
          newProblemScore.firstAcTime = now.toISOString();
        }

        participant.problemScores = {
          ...participant.problemScores,
          [problemId]: newProblemScore,
        };

        // Recalculate Totals
        participant.totalScore = Object.values(
          participant.problemScores,
        ).reduce((sum, ps) => sum + ps.score, 0);

        // Solved Count: Number of problems with firstAcTime set
        participant.solvedCount = Object.values(
          participant.problemScores,
        ).filter((ps) => ps.firstAcTime != null).length;

        // Finish Time: Sum of (firstAcTime - contestStart) for solved problems
        let totalFinishTimeMs = 0;
        Object.values(participant.problemScores).forEach((ps) => {
          if (ps.firstAcTime) {
            const acTime = new Date(ps.firstAcTime).getTime();
            const timeTaken = Math.max(0, acTime - startTime.getTime());
            totalFinishTimeMs += timeTaken;
          }
        });

        participant.finishTime = totalFinishTimeMs;
        participant.totalSubmissions += 1;
        participant.lastSubmissionAt = now;

        await this.participantRepository.save(participant);

        this.logger.debug(
          `Updated participant ${userId}: Score=${participant.totalScore}, Solved=${participant.solvedCount}`,
        );
        break;
      } catch (error: unknown) {
        const err = error as Error & { name?: string };
        if (err.name === 'OptimisticLockVersionMismatchError') {
          attempt++;
          if (attempt >= maxRetries) {
            this.logger.error(
              `Failed to update score for user ${userId} after ${maxRetries} attempts`,
              error,
            );
            throw error;
          }
          this.logger.warn(
            `Optimistic lock mismatch for user ${userId}, retrying... (Attempt ${attempt})`,
          );
          // Small delay backoff?
          await new Promise((res) => setTimeout(res, 50));
        } else {
          throw error;
        }
      }
    }

    // Invalidate cache
    await this.invalidateLeaderboardCache(contestId);

    // Publish update
    const entry = await this.getParticipantStanding(contestId, userId);
    if (entry) {
      await this.publishLeaderboardUpdate(contestId, entry);
    }
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
