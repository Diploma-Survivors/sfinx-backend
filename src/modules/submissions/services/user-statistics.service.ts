import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';
import { CacheService } from '../../redis/services/cache.service';
import { REDIS_TTL } from '../../redis/constants/redis.constants';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus } from '../enums/progress-status.enum';

/** Cache TTL for user statistics (5 minutes) */
const USER_STATS_CACHE_TTL = REDIS_TTL.FIVE_MINUTES;

/** Cache key prefix for user statistics */
const USER_STATS_CACHE_PREFIX = 'user-stats';

export interface UserStatistics {
  totalSubmissions: number;
  totalAccepted: number;
  totalProblemsAttempted: number;
  totalProblemsSolved: number;
  acceptanceRate: number;
  easyProblems: { solved: number; total: number };
  mediumProblems: { solved: number; total: number };
  hardProblems: { solved: number; total: number };
}

export interface DetailedUserStatistics extends UserStatistics {
  averageAttempts: number;
  averageRuntime: number | null;
  averageMemory: number | null;
  solveStreak: number;
  lastSolvedAt: Date | null;
}

/**
 * Service responsible for calculating user statistics
 * Follows Single Responsibility Principle
 */
@Injectable()
export class UserStatisticsService {
  private readonly logger = new Logger(UserStatisticsService.name);

  constructor(
    @InjectRepository(UserProblemProgress)
    private readonly progressRepository: Repository<UserProblemProgress>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate comprehensive user statistics with caching
   */
  async getUserStatistics(userId: number): Promise<UserStatistics> {
    const cacheKey = this.buildCacheKey(userId);

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.calculateUserStatistics(userId),
      {
        ttl: USER_STATS_CACHE_TTL,
        prefix: USER_STATS_CACHE_PREFIX,
        tags: [`user:${userId}`],
      },
    );
  }

  /**
   * Calculate user statistics (uncached)
   */
  private async calculateUserStatistics(
    userId: number,
  ): Promise<UserStatistics> {
    // Get all progress records
    const progressRecords = await this.progressRepository.find({
      where: { userId },
      relations: ['problem'],
    });

    const totalSubmissions = progressRecords.reduce(
      (sum, p) => sum + p.totalAttempts,
      0,
    );
    const totalAccepted = progressRecords.reduce(
      (sum, p) => sum + p.totalAccepted,
      0,
    );
    const totalProblemsAttempted = progressRecords.length;
    const totalProblemsSolved = progressRecords.filter(
      (p) => p.status === ProgressStatus.SOLVED,
    ).length;

    const acceptanceRate =
      totalSubmissions > 0
        ? Number(((totalAccepted / totalSubmissions) * 100).toFixed(2))
        : 0;

    // Count by difficulty
    const easyProblems = this.countByDifficulty(
      progressRecords,
      ProblemDifficulty.EASY,
    );
    const mediumProblems = this.countByDifficulty(
      progressRecords,
      ProblemDifficulty.MEDIUM,
    );
    const hardProblems = this.countByDifficulty(
      progressRecords,
      ProblemDifficulty.HARD,
    );

    return {
      totalSubmissions,
      totalAccepted,
      totalProblemsAttempted,
      totalProblemsSolved,
      acceptanceRate,
      easyProblems,
      mediumProblems,
      hardProblems,
    };
  }

  /**
   * Invalidate user statistics cache
   */
  async invalidateUserStatisticsCache(userId: number): Promise<void> {
    const cacheKey = this.buildCacheKey(userId);
    try {
      await this.cacheService.invalidate(cacheKey, USER_STATS_CACHE_PREFIX);
      this.logger.debug(`Invalidated statistics cache for user ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate statistics cache for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Build cache key for user statistics
   */
  private buildCacheKey(userId: number): string {
    return `user:${userId}:stats`;
  }

  /**
   * Count solved and total problems for a specific difficulty
   */
  private countByDifficulty(
    progressRecords: UserProblemProgress[],
    difficulty: ProblemDifficulty,
  ): { solved: number; total: number } {
    const filtered = progressRecords.filter(
      (p) => p.problem.difficulty === difficulty,
    );

    return {
      solved: filtered.filter((p) => p.status === ProgressStatus.SOLVED).length,
      total: filtered.length,
    };
  }
}
