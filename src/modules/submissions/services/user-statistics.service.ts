import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProblemDifficulty } from '../../problems/enums/problem-difficulty.enum';
import { UserProblemProgress } from '../entities/user-problem-progress.entity';
import { ProgressStatus } from '../enums/progress-status.enum';

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

/**
 * Service responsible for calculating user statistics
 * Follows Single Responsibility Principle
 */
@Injectable()
export class UserStatisticsService {
  constructor(
    @InjectRepository(UserProblemProgress)
    private readonly progressRepository: Repository<UserProblemProgress>,
  ) {}

  /**
   * Calculate comprehensive user statistics
   */
  async getUserStatistics(userId: number): Promise<UserStatistics> {
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
