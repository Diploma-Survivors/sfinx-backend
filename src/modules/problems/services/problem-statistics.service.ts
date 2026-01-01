import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Submission } from '../../submissions/entities/submission.entity';
import { SubmissionStatus } from '../../submissions/enums';
import {
  DistributionBucketDto,
  LanguageStatDto,
  ProblemStatisticsDto,
  VerdictCountDto,
} from '../dto/problem-statistics.dto';
import { Problem } from '../entities/problem.entity';

@Injectable()
export class ProblemStatisticsService {
  private readonly logger = new Logger(ProblemStatisticsService.name);

  constructor(
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  /**
   * Get comprehensive statistics for a problem
   */
  async getProblemStatistics(
    problemId: number,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<ProblemStatisticsDto> {
    // Verify problem exists
    const problem = await this.problemRepository.findOne({
      where: { id: problemId },
      select: ['id', 'title'],
    });

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    // Build base query
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .where('submission.problem.id = :problemId', { problemId });

    // Apply date filters if provided
    if (fromDate) {
      queryBuilder.andWhere('submission.submittedAt >= :fromDate', {
        fromDate,
      });
    }
    if (toDate) {
      queryBuilder.andWhere('submission.submittedAt <= :toDate', { toDate });
    }

    // Get total submissions and accepted count
    const [totalSubmissions, totalAccepted, uniqueSolvers] = await Promise.all([
      this.getTotalSubmissions(queryBuilder.clone()),
      this.getTotalAccepted(queryBuilder.clone()),
      this.getUniqueSolvers(queryBuilder.clone()),
    ]);

    // Calculate acceptance rate
    const acceptanceRate =
      totalSubmissions > 0
        ? Number(((totalAccepted / totalSubmissions) * 100).toFixed(2))
        : 0;

    // Get language stats
    const languageStats = await this.getLanguageStats(queryBuilder.clone());

    // Get verdicts (status distribution)
    const verdicts = await this.getVerdicts(
      queryBuilder.clone(),
      totalSubmissions,
    );

    // Get distributions
    const [runtimeDistribution, memoryDistribution] = await Promise.all([
      this.getRuntimeDistribution(queryBuilder.clone()),
      this.getMemoryDistribution(queryBuilder.clone()),
    ]);

    // Calculate generic average time to solve (simple avg runtime for now)
    // In a real scenario, this might need "first solve time - start time"
    const averageTimeToSolve =
      languageStats.length > 0
        ? languageStats.reduce(
            (acc, curr) => acc + curr.averageRuntime * curr.submissions,
            0,
          ) / totalSubmissions || 0
        : 0;

    return {
      problemId: problem.id,
      problemTitle: problem.title,
      totalSubmissions,
      totalAccepted,
      totalAttempts: totalSubmissions, // Simplified
      totalSolved: uniqueSolvers,
      averageTimeToSolve: Math.round(averageTimeToSolve),
      acceptanceRate,
      languageStats,
      verdicts,
      runtimeDistribution,
      memoryDistribution,
    };
  }

  // ... (previous helper methods: getTotalSubmissions, getTotalAccepted, getUniqueUsers, getUniqueSolvers)

  /**
   * Get total submissions count
   */
  private getTotalSubmissions(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<number> {
    return queryBuilder.getCount();
  }

  /**
   * Get total accepted submissions count
   */
  private getTotalAccepted(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<number> {
    return queryBuilder
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      })
      .getCount();
  }

  /**
   * Get count of unique users who attempted the problem
   */
  private async getUniqueUsers(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<number> {
    const result = await queryBuilder
      .select('COUNT(DISTINCT submission.user.id)', 'count')
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * Get count of unique users who solved the problem
   */
  private async getUniqueSolvers(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<number> {
    const result = await queryBuilder
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      })
      .select('COUNT(DISTINCT submission.user.id)', 'count')
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * Get language statistics
   */
  private async getLanguageStats(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<LanguageStatDto[]> {
    const results = await queryBuilder
      .leftJoin('submission.language', 'language')
      .select([
        'language.id as languageId',
        'language.name as languageName',
        'COUNT(*) as submissions',
        `SUM(CASE WHEN submission.status = '${SubmissionStatus.ACCEPTED}' THEN 1 ELSE 0 END) as acceptedSubmissions`,
        'AVG(submission.runtimeMs) as avgRuntime',
        'AVG(submission.memoryKb) as avgMemory',
      ])
      .groupBy('language.id')
      .addGroupBy('language.name')
      .orderBy('submissions', 'DESC')
      .limit(10)
      .getRawMany<{
        languageid: string;
        languagename: string;
        submissions: string;
        acceptedsubmissions: string;
        avgruntime: string | null;
        avgmemory: string | null;
      }>();

    return results.map((row) => {
      const submissions = parseInt(row.submissions, 10);
      const acceptedSubmissions = parseInt(row.acceptedsubmissions, 10);
      return {
        language: {
          id: parseInt(row.languageid, 10),
          name: row.languagename,
        },
        submissions,
        acceptedSubmissions,
        acceptanceRate:
          submissions > 0
            ? Number(((acceptedSubmissions / submissions) * 100).toFixed(2))
            : 0,
        averageRuntime: parseFloat(row.avgruntime ?? '0'),
        averageMemory: parseFloat(row.avgmemory ?? '0'),
      };
    });
  }

  /**
   * Get verdicts (status distribution)
   */
  private async getVerdicts(
    queryBuilder: SelectQueryBuilder<Submission>,
    totalSubmissions: number,
  ): Promise<VerdictCountDto[]> {
    const results = await queryBuilder
      .select(['submission.status as status', 'COUNT(*) as count'])
      .groupBy('submission.status')
      .orderBy('count', 'DESC')
      .getRawMany<{ status: string; count: string }>();

    return results.map((row) => {
      const count = parseInt(row.count, 10);
      return {
        verdict: row.status as SubmissionStatus,
        count,
        percentage:
          totalSubmissions > 0
            ? Number(((count / totalSubmissions) * 100).toFixed(2))
            : 0,
      };
    });
  }

  /**
   * Get Runtime Distribution buckets
   */
  private async getRuntimeDistribution(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<DistributionBucketDto[]> {
    // Note: In real scenarios, you might want to dynamically calculate bucket sizes (e.g., using percentiles)
    // Here we use fixed ranges for simplicity: 0-10ms, 10-50ms, 50-100ms, 100-500ms, >500ms
    const results = await queryBuilder
      .select(
        `
        CASE
          WHEN submission.runtimeMs <= 10 THEN '0-10ms'
          WHEN submission.runtimeMs <= 50 THEN '10-50ms'
          WHEN submission.runtimeMs <= 100 THEN '50-100ms'
          WHEN submission.runtimeMs <= 500 THEN '100-500ms'
          ELSE '>500ms'
        END
      `,
        'range',
      )
      .addSelect('MIN(submission.runtimeMs)', 'value')
      .addSelect('COUNT(*)', 'count')
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      }) // Usually distribution is for accepted solutions
      .groupBy('range')
      .orderBy('value', 'ASC')
      .getRawMany<{ range: string; value: string; count: string }>();

    return results.map((r) => ({
      range: r.range,
      value: parseFloat(r.value ?? '0'),
      count: parseInt(r.count, 10),
      percentile: 0, // Simplified
    }));
  }

  /**
   * Get Memory Distribution buckets
   */
  private async getMemoryDistribution(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<DistributionBucketDto[]> {
    // Fixed ranges: 0-5MB, 5-10MB, 10-50MB, >50MB
    // Note: DB stores KB
    const results = await queryBuilder
      .select(
        `
        CASE
          WHEN submission.memoryKb <= 5120 THEN '0-5MB'
          WHEN submission.memoryKb <= 10240 THEN '5-10MB'
          WHEN submission.memoryKb <= 51200 THEN '10-50MB'
          ELSE '>50MB'
        END
      `,
        'range',
      )
      .addSelect('MIN(submission.memoryKb)', 'value')
      .addSelect('COUNT(*)', 'count')
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      })
      .groupBy('range')
      .orderBy('value', 'ASC')
      .getRawMany<{ range: string; value: string; count: string }>();

    return results.map((r) => ({
      range: r.range,
      value: parseFloat(r.value ?? '0'),
      count: parseInt(r.count, 10),
      percentile: 0, // Simplified
    }));
  }
}
