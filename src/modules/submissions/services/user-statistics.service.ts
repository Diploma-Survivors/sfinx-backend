import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';
import { CacheKeys, CacheService, RedisService } from '../../redis';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { Submission } from '../entities/submission.entity';
import { ProgressStatus, SubmissionStatus } from '../enums';
import { SUBMISSION_CACHE } from '../constants/submission.constants';
import { UserStatisticsDto } from '../dto/user-statistics.dto';
import { User } from '../../auth/entities/user.entity';
import { SystemConfigService } from '../../system-config/system-config.service';

@Injectable()
export class UserStatisticsService {
  private readonly logger = new Logger(UserStatisticsService.name);

  constructor(
    @InjectRepository(UserProblemProgress)
    private readonly progressRepository: Repository<UserProblemProgress>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * Calculate comprehensive user statistics with caching
   */
  async getUserStatistics(userId: number): Promise<UserStatisticsDto> {
    const cacheKey = CacheKeys.user.statistics(userId);

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.calculateUserStatistics(userId),
      {
        ttl: SUBMISSION_CACHE.USER_STATS_TTL,
        prefix: SUBMISSION_CACHE.USER_STATS_PREFIX,
        tags: [`user:${userId}`],
      },
    );
  }

  /**
   * Calculate user statistics (uncached)
   */
  private async calculateUserStatistics(
    userId: number,
  ): Promise<UserStatisticsDto> {
    // 1. Get user with stats directly from User table (O(1))
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['solvedEasy', 'solvedMedium', 'solvedHard', 'globalScore'],
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // 2. Get system-wide problem counts by difficulty (Total count)
    // Cache this or keep as is (Problem table is small enough for now)
    const systemDifficultyStats = await this.problemRepository
      .createQueryBuilder('problem')
      .select('problem.difficulty', 'difficulty')
      .addSelect('COUNT(*)', 'total')
      .where('problem.isActive = :isActive', { isActive: true })
      .groupBy('problem.difficulty')
      .getRawMany<{
        difficulty: ProblemDifficulty;
        total: string;
      }>();

    // Helper to extract stats
    const getStatsForDiff = (diff: ProblemDifficulty) => {
      let solvedCount = 0;
      switch (diff) {
        case ProblemDifficulty.EASY:
          solvedCount = user.solvedEasy;
          break;
        case ProblemDifficulty.MEDIUM:
          solvedCount = user.solvedMedium;
          break;
        case ProblemDifficulty.HARD:
          solvedCount = user.solvedHard;
          break;
      }

      const systemStat = systemDifficultyStats.find(
        (s) => s.difficulty === diff,
      );

      const totalCount = parseInt(systemStat?.total ?? '0', 10);

      return {
        solved: solvedCount,
        total: totalCount,
      };
    };

    // Get submission statistics
    const submissionStats = await this.getSubmissionStats(userId);

    // Calculate total system problems (sum of totals from system stats)
    const totalSystemProblems = systemDifficultyStats.reduce(
      (sum, stat) => sum + parseInt(stat.total, 10),
      0,
    );

    return {
      problemStats: {
        easy: getStatsForDiff(ProblemDifficulty.EASY),
        medium: getStatsForDiff(ProblemDifficulty.MEDIUM),
        hard: getStatsForDiff(ProblemDifficulty.HARD),
        total: {
          solved: user.solvedEasy + user.solvedMedium + user.solvedHard,
          total: totalSystemProblems,
        },
      },
      submissionStats: {
        ...submissionStats, // Contains total and accepted from Submission table
      },
    };
  }

  /**
   * Get detailed submission statistics breakdown
   */
  private async getSubmissionStats(userId: number) {
    const stats = await this.submissionRepository
      .createQueryBuilder('submission')
      .select('submission.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('submission.user.id = :userId', { userId })
      .groupBy('submission.status')
      .getRawMany<{ status: SubmissionStatus; count: string }>();

    const result = {
      accepted: 0,
      wrongAnswer: 0,
      timeLimitExceeded: 0,
      runtimeError: 0,
      compilationError: 0,
      others: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      const count = parseInt(stat.count, 10);
      result.total += count;

      switch (stat.status) {
        case SubmissionStatus.ACCEPTED:
          result.accepted = count;
          break;
        case SubmissionStatus.WRONG_ANSWER:
          result.wrongAnswer = count;
          break;
        case SubmissionStatus.TIME_LIMIT_EXCEEDED:
          result.timeLimitExceeded = count;
          break;
        case SubmissionStatus.RUNTIME_ERROR:
          result.runtimeError = count;
          break;
        case SubmissionStatus.COMPILATION_ERROR:
          result.compilationError = count;
          break;
        default:
          result.others += count;
          break;
      }
    });

    return result;
  }

  /**
   * Get list of years where user has activity
   */
  async getActivityYears(userId: number): Promise<number[]> {
    const result = await this.submissionRepository
      .createQueryBuilder('submission')
      .select('DISTINCT EXTRACT(YEAR FROM submission.submittedAt)', 'year')
      .where('submission.user.id = :userId', { userId })
      .orderBy('year', 'DESC')
      .getRawMany<{ year: string }>();

    return result.map((row) => parseInt(row.year, 10));
  }

  /**
   * Get activity calendar (heatmap) for a specific year
   */
  async getActivityCalendar(
    userId: number,
    year: number = new Date().getFullYear(),
  ): Promise<{
    totalActiveDays: number;
    activeDays: { date: string; count: number }[];
  }> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const result = await this.submissionRepository
      .createQueryBuilder('submission')
      .select("TO_CHAR(submission.submittedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('submission.user.id = :userId', { userId })
      .andWhere('submission.submittedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('date')
      .getRawMany<{ date: string; count: string }>();

    const activeDays = result.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));

    return {
      totalActiveDays: activeDays.length,
      activeDays,
    };
  }

  /**
   * Invalidate user statistics cache
   */
  async invalidateUserStatisticsCache(userId: number): Promise<void> {
    const cacheKey = CacheKeys.user.statistics(userId);
    try {
      await this.cacheService.invalidate(
        cacheKey,
        SUBMISSION_CACHE.USER_STATS_PREFIX,
      );
      this.logger.debug(`Invalidated statistics cache for user ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate statistics cache for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Increment User's Global Score based on a newly solved problem
   * Optimized to avoid full recalculation
   */
  async incrementGlobalScore(userId: number, problemId: number): Promise<void> {
    const problem = await this.problemRepository.findOne({
      where: { id: problemId },
      select: ['difficulty'],
    });

    if (!problem) {
      this.logger.warn(`Problem ${problemId} not found for score increment`);
      return;
    }

    const weightEasy = this.systemConfigService.getInt(
      'PROBLEM_WEIGHT_EASY',
      10,
    );
    const weightMedium = this.systemConfigService.getInt(
      'PROBLEM_WEIGHT_MEDIUM',
      20,
    );
    const weightHard = this.systemConfigService.getInt(
      'PROBLEM_WEIGHT_HARD',
      30,
    );

    let weight = 0;
    switch (problem.difficulty) {
      case ProblemDifficulty.EASY:
        weight = weightEasy;
        break;
      case ProblemDifficulty.MEDIUM:
        weight = weightMedium;
        break;
      case ProblemDifficulty.HARD:
        weight = weightHard;
        break;
    }

    if (weight > 0) {
      // Atomic update of score AND stats using query builder for custom SQL increment
      const updateData: QueryDeepPartialEntity<User> = {
        globalScore: () => `global_score + ${weight}`,
      };

      switch (problem.difficulty) {
        case ProblemDifficulty.EASY:
          updateData.solvedEasy = () => `solved_easy + 1`;
          break;
        case ProblemDifficulty.MEDIUM:
          updateData.solvedMedium = () => `solved_medium + 1`;
          break;
        case ProblemDifficulty.HARD:
          updateData.solvedHard = () => `solved_hard + 1`;
          break;
      }

      updateData.lastSolveAt = new Date(); // Update tie-breaker

      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set(updateData)
        .where('id = :id', { id: userId })
        .execute();

      this.logger.debug(
        `Incremented global score and stats for user ${userId} by ${weight}`,
      );
      await this.invalidateUserStatisticsCache(userId);

      // Async: Update Redis Ranking
      // Score Encoding: Score * 1e10 + (MAX_TIMESTAMP - CurrentTimestamp)
      // This allows sorting by Score DESC, then Time ASC (Earlier is better)
      try {
        await this.recalculateGlobalScore(userId); // Call recalculate to ensure Redis consistency
      } catch (error) {
        this.logger.error(
          `Failed to update Redis ranking for user ${userId}`,
          error,
        );
      }
    }
  }

  /**
   * Recalculate global score from scratch (useful for reconciliation)
   * Also updates the Redis ZSET ranking
   */
  async recalculateGlobalScore(userId: number): Promise<void> {
    // 1. Get solved count by difficulty
    const solvedStats = await this.progressRepository
      .createQueryBuilder('progress')
      .leftJoin('progress.problem', 'problem')
      .select('problem.difficulty', 'difficulty')
      .addSelect('COUNT(*)', 'count')
      .where('progress.userId = :userId', { userId })
      .andWhere('progress.status = :status', { status: ProgressStatus.SOLVED })
      .groupBy('problem.difficulty')
      .getRawMany<{ difficulty: ProblemDifficulty; count: string }>();

    // 2. Get Weights
    const weightEasy = this.systemConfigService.getInt(
      'PROBLEM_WEIGHT_EASY',
      10,
    );
    const weightMedium = this.systemConfigService.getInt(
      'PROBLEM_WEIGHT_MEDIUM',
      20,
    );
    const weightHard = this.systemConfigService.getInt(
      'PROBLEM_WEIGHT_HARD',
      30,
    );

    // 3. Calculate Score
    let totalScore = 0;
    solvedStats.forEach((stat) => {
      const count = parseInt(stat.count, 10);
      switch (stat.difficulty) {
        case ProblemDifficulty.EASY:
          totalScore += count * weightEasy;
          break;
        case ProblemDifficulty.MEDIUM:
          totalScore += count * weightMedium;
          break;
        case ProblemDifficulty.HARD:
          totalScore += count * weightHard;
          break;
      }
    });

    // 4. Update User
    await this.userRepository.update(userId, { globalScore: totalScore });
    await this.invalidateUserStatisticsCache(userId);

    // Update Redis Ranking
    try {
      // Need last solve time for correct encoding.
      const lastSolve = await this.progressRepository
        .createQueryBuilder('p')
        .select('MAX(p.solvedAt)', 'lastSolve')
        .where('p.userId = :userId', { userId })
        .andWhere('p.status = :status', { status: ProgressStatus.SOLVED })
        .getRawOne<{ lastSolve: string | Date }>();

      const lastSolveTime = lastSolve?.lastSolve
        ? Math.floor(new Date(lastSolve.lastSolve).getTime() / 1000)
        : 0;
      const MAX_TIMESTAMP = 9999999999;

      const encodedScore = totalScore * 1e10 + (MAX_TIMESTAMP - lastSolveTime);
      const GLOBAL_RANKING_KEY = 'global:ranking';
      await this.redisService.zadd(
        GLOBAL_RANKING_KEY,
        encodedScore,
        userId.toString(),
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync Redis ranking for user ${userId}`,
        error,
      );
    }

    this.logger.log(
      `Recalculated global score for user ${userId}: ${totalScore}`,
    );
  }

  /**
   * @deprecated Use recalculateGlobalScore or incrementGlobalScore
   */
  async updateGlobalScore(userId: number): Promise<void> {
    return this.recalculateGlobalScore(userId);
  }
}
