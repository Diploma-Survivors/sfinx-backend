import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResultDto, SortOrder } from '../../../common';
import { CacheService } from '../../redis/services/cache.service';
import { PubSubService } from '../../redis/services/pubsub.service';
import { CacheKeys } from '../../redis/utils/cache-key.builder';
import {
  LeaderboardEntryDto,
  ProblemScoreDto,
} from '../dto/leaderboard-entry.dto';
import {
  ContestParticipant,
  ProblemScore,
} from '../entities/contest-participant.entity';
import { ContestProblem } from '../entities/contest-problem.entity';
import { ILeaderboardEntry, ILeaderboardUpdateEvent } from '../interfaces';

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
    private readonly cacheService: CacheService,
    private readonly pubSubService: PubSubService,
  ) {}

  /**
   * Get leaderboard for a contest with pagination
   */
  async getLeaderboard(
    contestId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResultDto<LeaderboardEntryDto>> {
    const cacheKey = CacheKeys.contest.leaderboard(contestId, page, limit);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const skip = (page - 1) * limit;

        const [participants, total] =
          await this.participantRepository.findAndCount({
            where: { contestId },
            relations: ['user'],
            order: {
              totalScore: SortOrder.DESC,
              lastSubmissionAt: SortOrder.ASC,
            },
            skip,
            take: limit,
          });

        // Get contest problems for score breakdown
        const contestProblems = await this.contestProblemRepository.find({
          where: { contestId },
          order: { orderIndex: SortOrder.ASC },
        });

        // Calculate ranks (considering there might be ties)
        let currentRank = skip + 1;
        let lastScore: number | null = null;
        let lastTime: Date | null = null;

        const data: LeaderboardEntryDto[] = participants.map((p, index) => {
          // Handle ranking with tiebreakers
          if (
            lastScore !== null &&
            (Number(p.totalScore) !== lastScore ||
              p.lastSubmissionAt?.getTime() !== lastTime?.getTime())
          ) {
            currentRank = skip + index + 1;
          }
          lastScore = Number(p.totalScore);
          lastTime = p.lastSubmissionAt;

          // Build problem scores array
          const problemScores: ProblemScoreDto[] = contestProblems.map((cp) => {
            const ps = p.problemScores[cp.problemId] ?? {
              score: 0,
              submissions: 0,
              lastSubmitTime: null,
            };
            return {
              problemId: cp.problemId,
              score: ps.score,
              submissions: ps.submissions,
              lastSubmitTime: ps.lastSubmitTime,
            };
          });

          return {
            rank: currentRank,
            userId: p.userId,
            username: p.user?.username ?? 'Unknown',
            avatarUrl: p.user?.avatarUrl ?? null,
            totalScore: Number(p.totalScore),
            problemScores,
            totalSubmissions: p.totalSubmissions,
            lastSubmissionAt: p.lastSubmissionAt?.toISOString() ?? null,
          };
        });

        return new PaginatedResultDto(data, { page, limit, total });
      },
      { ttl: LEADERBOARD_CACHE_TTL },
    );
  }

  /**
   * Update participant score after a submission is judged
   * IOI Scoring: score = (passed_testcases / total_testcases) * problem_points
   * Only keeps the best score per problem
   */
  async updateParticipantScore(
    contestId: number,
    userId: number,
    problemId: number,
    passedTestcases: number,
    totalTestcases: number,
  ): Promise<void> {
    // Get the problem points
    const contestProblem = await this.contestProblemRepository.findOne({
      where: { contestId, problemId },
    });

    if (!contestProblem) {
      this.logger.warn(
        `Problem ${problemId} not found in contest ${contestId}`,
      );
      return;
    }

    // Get participant
    const participant = await this.participantRepository.findOne({
      where: { contestId, userId },
      relations: ['user'],
    });

    if (!participant) {
      this.logger.warn(
        `Participant ${userId} not found in contest ${contestId}`,
      );
      return;
    }

    // Calculate score for this submission
    const submissionScore = this.calculateScore(
      passedTestcases,
      totalTestcases,
      contestProblem.points,
    );

    // Get current best score for this problem
    const currentProblemScore = participant.problemScores[problemId] ?? {
      score: 0,
      submissions: 0,
      lastSubmitTime: null,
    };

    const now = new Date().toISOString();

    // Update problem score (keep best)
    const newProblemScore: ProblemScore = {
      score: Math.max(submissionScore, currentProblemScore.score),
      submissions: currentProblemScore.submissions + 1,
      lastSubmitTime: now,
    };

    // Update problemScores object
    participant.problemScores = {
      ...participant.problemScores,
      [problemId]: newProblemScore,
    };

    // Recalculate total score
    participant.totalScore = Object.values(participant.problemScores).reduce(
      (sum, ps) => sum + ps.score,
      0,
    );

    // Update submission count and last submission time
    participant.totalSubmissions += 1;
    participant.lastSubmissionAt = new Date();

    // Save changes
    await this.participantRepository.save(participant);

    // Recalculate ranks for all participants
    await this.recalculateRanks(contestId);

    // Invalidate cache
    await this.invalidateLeaderboardCache(contestId);

    // Publish update event for SSE
    const entry = await this.getParticipantStanding(contestId, userId);
    if (entry) {
      await this.publishLeaderboardUpdate(contestId, entry);
    }

    this.logger.debug(
      `Updated score for user ${userId} in contest ${contestId}: ` +
        `problem ${problemId} = ${submissionScore}, total = ${participant.totalScore}`,
    );
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
   * Recalculate and update ranks for all participants
   */
  async recalculateRanks(contestId: number): Promise<void> {
    // Get all participants sorted by score and time
    const participants = await this.participantRepository.find({
      where: { contestId },
      order: {
        totalScore: SortOrder.DESC,
        lastSubmissionAt: SortOrder.ASC,
      },
    });

    // Assign ranks (handling ties)
    let currentRank = 1;
    let lastScore: number | null = null;
    let lastTime: Date | null = null;

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];

      if (
        lastScore !== null &&
        (Number(p.totalScore) !== lastScore ||
          p.lastSubmissionAt?.getTime() !== lastTime?.getTime())
      ) {
        currentRank = i + 1;
      }

      p.rank = currentRank;
      lastScore = Number(p.totalScore);
      lastTime = p.lastSubmissionAt;
    }

    // Batch update
    await this.participantRepository.save(participants);
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

    // Build problem scores
    const problemScores: ProblemScoreDto[] = contestProblems.map((cp) => {
      const ps = participant.problemScores[cp.problemId] ?? {
        score: 0,
        submissions: 0,
        lastSubmitTime: null,
      };
      return {
        problemId: cp.problemId,
        score: ps.score,
        submissions: ps.submissions,
        lastSubmitTime: ps.lastSubmitTime,
      };
    });

    return {
      rank: participant.rank ?? 0,
      userId: participant.userId,
      username: participant.user?.username ?? 'Unknown',
      avatarUrl: participant.user?.avatarUrl ?? null,
      totalScore: Number(participant.totalScore),
      problemScores,
      totalSubmissions: participant.totalSubmissions,
      lastSubmissionAt: participant.lastSubmissionAt?.toISOString() ?? null,
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
      entry: entry as ILeaderboardEntry,
      timestamp: Date.now(),
    };

    await this.pubSubService.publish(channel, JSON.stringify(event));
    this.logger.debug(
      `Published leaderboard update for contest ${contestId}, user ${entry.userId}`,
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
