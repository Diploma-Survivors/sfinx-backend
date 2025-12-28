import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';
import { CacheService } from '../../redis/services/cache.service';
import { CacheKeys } from '../../redis/utils/cache-key.builder';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus } from '../enums/progress-status.enum';
import { UserStatistics } from '../interfaces/user-statistics.interface';
import { SUBMISSION_CACHE } from '../constants/submission.constants';

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
