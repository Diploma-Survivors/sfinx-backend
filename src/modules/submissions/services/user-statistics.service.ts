import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';
import { CacheService } from '../../redis';
import { CacheKeys } from '../../redis';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { Submission } from '../entities/submission.entity';
import { ProgressStatus, SubmissionStatus } from '../enums';
import { SUBMISSION_CACHE } from '../constants/submission.constants';
import { UserStatisticsDto } from '../dto/user-statistics.dto';

@Injectable()
export class UserStatisticsService {
  private readonly logger = new Logger(UserStatisticsService.name);

  constructor(
    @InjectRepository(UserProblemProgress)
    private readonly progressRepository: Repository<UserProblemProgress>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly cacheService: CacheService,
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
  /**
   * Calculate user statistics (uncached)
   */
  private async calculateUserStatistics(
    userId: number,
  ): Promise<UserStatisticsDto> {
    // 1. Get aggregate totals directly from DB
    const aggregates = await this.progressRepository
      .createQueryBuilder('progress')
      .select('SUM(progress.totalAttempts)', 'totalSubmissions')
      .addSelect('SUM(progress.totalAccepted)', 'totalAccepted')
      .addSelect('COUNT(*)', 'totalProblemsAttempted')
      .addSelect(
        `SUM(CASE WHEN progress.status = '${ProgressStatus.SOLVED}' THEN 1 ELSE 0 END)`,
        'totalProblemsSolved',
      )
      .where('progress.userId = :userId', { userId })
      .getRawOne<{
        totalSubmissions: string;
        totalAccepted: string;
        totalProblemsAttempted: string;
        totalProblemsSolved: string;
      }>();

    // 2. Get difficulty breakdown (Solved vs Total)
    const difficultyStats = await this.progressRepository
      .createQueryBuilder('progress')
      .leftJoin('progress.problem', 'problem')
      .select('problem.difficulty', 'difficulty')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN progress.status = '${ProgressStatus.SOLVED}' THEN 1 ELSE 0 END)`,
        'solved',
      )
      .where('progress.userId = :userId', { userId })
      .groupBy('problem.difficulty')
      .getRawMany<{
        difficulty: ProblemDifficulty;
        total: string;
        solved: string;
      }>();

    // Helper to extract stats
    const getStatsForDiff = (diff: ProblemDifficulty) => {
      const stat = difficultyStats.find((s) => s.difficulty === diff);
      return {
        solved: parseInt(stat?.solved ?? '0', 10),
        total: parseInt(stat?.total ?? '0', 10),
      };
    };

    // Get submission statistics
    const submissionStats = await this.getSubmissionStats(userId);

    const tSubmissions = parseInt(aggregates?.totalSubmissions ?? '0', 10);
    const tAccepted = parseInt(aggregates?.totalAccepted ?? '0', 10);

    return {
      problemStats: {
        easy: getStatsForDiff(ProblemDifficulty.EASY),
        medium: getStatsForDiff(ProblemDifficulty.MEDIUM),
        hard: getStatsForDiff(ProblemDifficulty.HARD),
        total: {
          solved: parseInt(aggregates?.totalProblemsSolved ?? '0', 10),
          total: parseInt(aggregates?.totalProblemsAttempted ?? '0', 10),
        },
      },
      submissionStats: {
        ...submissionStats,
        total: tSubmissions,
        accepted: tAccepted,
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
}
