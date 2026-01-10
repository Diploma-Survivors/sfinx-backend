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
import { WIDTH_BUCKET_STATISTIC } from '../../../common';

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
    return this.getNumericDistribution(
      queryBuilder,
      'submission.runtimeMs',
      'ms',
      WIDTH_BUCKET_STATISTIC,
    );
  }

  /**
   * Get Memory Distribution buckets
   */
  private async getMemoryDistribution(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<DistributionBucketDto[]> {
    return this.getNumericDistribution(
      queryBuilder,
      'submission.memoryKb',
      'KB',
      WIDTH_BUCKET_STATISTIC,
    );
  }

  /**
   * Helper to generate dynamic distribution buckets
   */
  private async getNumericDistribution(
    baseQuery: SelectQueryBuilder<Submission>,
    column: string,
    unit: string,
    bucketCount = 20,
  ): Promise<DistributionBucketDto[]> {
    // 1. Get min and max values first
    const stats = await baseQuery
      .andWhere('submission.status = :status', {
        status: SubmissionStatus.ACCEPTED,
      })
      .select(`MIN(${column})`, 'minVal')
      .addSelect(`MAX(${column})`, 'maxVal')
      .addSelect('COUNT(*)', 'totalCount')
      .getRawOne<{ minVal: string; maxVal: string; totalCount: string }>();

    if (!stats || !stats.totalCount || parseInt(stats.totalCount, 10) === 0) {
      return [];
    }

    const minVal = parseFloat(stats.minVal ?? '0');
    const maxVal = parseFloat(stats.maxVal ?? '0');
    const totalCount = parseInt(stats.totalCount, 10);

    // Handle single value case
    if (Math.abs(maxVal - minVal) < 0.01) {
      return [
        {
          range: `${minVal}${unit}`,
          value: minVal,
          count: totalCount,
          percentile: 100,
        },
      ];
    }

    // 2. Use width_bucket to group data
    // Note: We cast width_bucket result to integer
    const results = await baseQuery
      .select(
        `width_bucket(${column}, ${minVal}, ${maxVal}, ${bucketCount})`,
        'bucket',
      )
      .addSelect(`MIN(${column})`, 'bucketMin')
      .addSelect(`MAX(${column})`, 'bucketMax')
      .addSelect('COUNT(*)', 'count')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{
        bucket: string;
        bucketMin: string;
        bucketMax: string;
        count: string;
      }>();

    // 3. Process results to calculate percentiles and format output
    let accumulatedCount = 0;
    const bucketSize = (maxVal - minVal) / bucketCount;

    return results.map((row) => {
      const count = parseInt(row.count, 10);
      accumulatedCount += count;

      const bucketIdx = parseInt(row.bucket, 10);
      const start = minVal + (bucketIdx - 1) * bucketSize;
      const end = minVal + bucketIdx * bucketSize;

      // Calculate percentile: percentage of users slower/worse than this bucket (or accumulated up to this?)
      // Typically "beat X%" means X% have value > current.
      // Lower runtime is better. "Beats 80%" = 80% have runtime > mine.
      // Here we just return cumulative distribution for simplicity
      const cumulativePercent = (accumulatedCount / totalCount) * 100;

      // Format range depending on unit and size
      // For KB, convert to MB if large? Sticking to unit passing for now.
      // If unit is KB and value > 1024, maybe format? but spec says memoryDistribution ...
      // Let's keep it simple as requested: "dynamic calculation"

      let rangeLabel = '';
      if (unit === 'KB' && start >= 1024) {
        rangeLabel = `${(start / 1024).toFixed(1)}-${(end / 1024).toFixed(1)}MB`;
      } else {
        rangeLabel = `${start.toFixed(0)}-${end.toFixed(0)}${unit}`;
      }

      return {
        range: rangeLabel,
        value: parseFloat(row.bucketMin), // Use actual min in bucket as plotting value
        count,
        percentile: Number(cumulativePercent.toFixed(2)),
      };
    });
  }
}
