import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SortOrder } from 'src/common';
import { Submission } from '../entities/submission.entity';
import { SubmissionStatus } from '../enums/submission-status.enum';

export interface DistributionBin {
  bin: string;
  count: number;
  min: number;
  max: number;
}

export interface SubmissionPerformanceStats {
  averageRuntime: number | null;
  averageMemory: number | null;
  fastestRuntime: number | null;
  lowestMemory: number | null;
  percentile: {
    runtime: number | null;
    memory: number | null;
  };
  distribution?: {
    runtime: DistributionBin[];
    memory: DistributionBin[];
  };
}

export interface RelevantSubmission {
  id: number;
  userId: number;
  username: string;
  runtimeMs: number | null;
  memoryKb: number | null;
  languageName: string;
  submittedAt: Date;
}

/**
 * Service for analyzing submissions and providing insights
 * Provides analytics and comparison features
 */
@Injectable()
export class SubmissionAnalysisService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  /**
   * Get relevant (similar) submissions for comparison
   * Returns accepted submissions for the same problem, ordered by performance
   */
  async getRelevantSubmissions(
    problemId: number,
    languageId?: number,
    limit: number = 10,
  ): Promise<RelevantSubmission[]> {
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.user', 'user')
      .leftJoinAndSelect('submission.language', 'language')
      .where('submission.problem.id = :problemId', { problemId })
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      })
      .andWhere('submission.runtimeMs IS NOT NULL')
      .orderBy('submission.runtimeMs', SortOrder.ASC)
      .addOrderBy('submission.memoryKb', SortOrder.ASC)
      .take(limit);

    if (languageId) {
      queryBuilder.andWhere('submission.language.id = :languageId', {
        languageId,
      });
    }

    const submissions = await queryBuilder.getMany();

    return submissions.map((s) => ({
      id: s.id,
      userId: s.user.id,
      username: s.user.username,
      runtimeMs: s.runtimeMs,
      memoryKb: s.memoryKb,
      languageName: s.language.name,
      submittedAt: s.submittedAt,
    }));
  }

  /**
   * Calculate performance statistics for a submission compared to others
   */
  async calculatePerformanceStats(
    submissionId: number,
  ): Promise<SubmissionPerformanceStats | null> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['problem'],
    });

    if (!submission || submission.status !== SubmissionStatus.ACCEPTED) {
      return null;
    }

    const { problem, runtimeMs, memoryKb } = submission;

    // Get all accepted submissions for comparison
    const allAccepted = await this.submissionRepository.find({
      where: {
        problem: { id: problem.id },
        status: SubmissionStatus.ACCEPTED,
      },
      select: ['runtimeMs', 'memoryKb'],
    });

    if (allAccepted.length === 0) {
      return null;
    }

    // Calculate average runtime and memory
    const validRuntimes = allAccepted
      .filter((s) => s.runtimeMs !== null)
      .map((s) => s.runtimeMs!);
    const validMemories = allAccepted
      .filter((s) => s.memoryKb !== null)
      .map((s) => s.memoryKb!);

    const averageRuntime =
      validRuntimes.length > 0
        ? validRuntimes.reduce((a, b) => a + b, 0) / validRuntimes.length
        : null;

    const averageMemory =
      validMemories.length > 0
        ? validMemories.reduce((a, b) => a + b, 0) / validMemories.length
        : null;

    // Find fastest and lowest memory
    const fastestRuntime =
      validRuntimes.length > 0 ? Math.min(...validRuntimes) : null;
    const lowestMemory =
      validMemories.length > 0 ? Math.min(...validMemories) : null;

    // Calculate percentile rank
    const runtimePercentile = runtimeMs
      ? this.calculatePercentile(runtimeMs, validRuntimes)
      : null;
    const memoryPercentile = memoryKb
      ? this.calculatePercentile(memoryKb, validMemories)
      : null;

    // Calculate distributions
    const runtimeDistribution = this.calculateDistribution(validRuntimes, 10);
    const memoryDistribution = this.calculateDistribution(validMemories, 10);

    return {
      averageRuntime,
      averageMemory,
      fastestRuntime,
      lowestMemory,
      percentile: {
        runtime: runtimePercentile,
        memory: memoryPercentile,
      },
      distribution: {
        runtime: runtimeDistribution,
        memory: memoryDistribution,
      },
    };
  }

  /**
   * Calculate percentile rank (lower is better)
   */
  private calculatePercentile(value: number, dataset: number[]): number {
    if (dataset.length === 0) return 0;

    const sorted = [...dataset].sort((a, b) => a - b);
    const rank = sorted.filter((v) => v < value).length;
    return Math.round((rank / dataset.length) * 100);
  }

  /**
   * Calculate distribution for histogram
   */
  private calculateDistribution(
    dataset: number[],
    binCount: number,
  ): DistributionBin[] {
    if (dataset.length === 0) return [];

    const min = Math.min(...dataset);
    const max = Math.max(...dataset);

    if (min === max) {
      return [{ bin: `${min.toFixed(2)}`, count: dataset.length, min, max }];
    }

    // Calculate bin width
    const binWidth = (max - min) / binCount;

    // Initialize bins
    const bins: DistributionBin[] = Array.from(
      { length: binCount },
      (_, i) => ({
        bin: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
        min: min + i * binWidth,
        max: min + (i + 1) * binWidth,
        count: 0,
      }),
    );

    // Count items in each bin
    dataset.forEach((value) => {
      let binIndex = Math.floor((value - min) / binWidth);
      // Handle the edge case where value === max
      if (binIndex >= binCount) {
        binIndex = binCount - 1;
      }
      bins[binIndex].count++;
    });

    return bins;
  }

  /**
   * Get top performers for a problem
   */
  async getTopPerformers(
    problemId: number,
    limit: number = 10,
  ): Promise<RelevantSubmission[]> {
    const submissions = await this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.user', 'user')
      .leftJoinAndSelect('submission.language', 'language')
      .where('submission.problem.id = :problemId', { problemId })
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      })
      .andWhere('submission.runtimeMs IS NOT NULL')
      .orderBy('submission.runtimeMs', SortOrder.ASC)
      .take(limit)
      .getMany();

    return submissions.map((s) => ({
      id: s.id,
      userId: s.user.id,
      username: s.user.username,
      runtimeMs: s.runtimeMs,
      memoryKb: s.memoryKb,
      languageName: s.language.name,
      submittedAt: s.submittedAt,
    }));
  }

  /**
   * Compare two submissions
   */
  async compareSubmissions(
    submissionId1: number,
    submissionId2: number,
  ): Promise<{
    submission1: Submission;
    submission2: Submission;
    runtimeDiff: number | null;
    memoryDiff: number | null;
    faster: number | null;
  } | null> {
    const [sub1, sub2] = await Promise.all([
      this.submissionRepository.findOne({
        where: { id: submissionId1 },
        relations: ['user', 'language', 'problem'],
      }),
      this.submissionRepository.findOne({
        where: { id: submissionId2 },
        relations: ['user', 'language', 'problem'],
      }),
    ]);

    if (!sub1 || !sub2) {
      return null;
    }

    const runtimeDiff =
      sub1.runtimeMs && sub2.runtimeMs ? sub1.runtimeMs - sub2.runtimeMs : null;

    const memoryDiff =
      sub1.memoryKb && sub2.memoryKb ? sub1.memoryKb - sub2.memoryKb : null;

    const faster =
      runtimeDiff !== null
        ? runtimeDiff < 0
          ? submissionId1
          : submissionId2
        : null;

    return {
      submission1: sub1,
      submission2: sub2,
      runtimeDiff,
      memoryDiff,
      faster,
    };
  }
}
