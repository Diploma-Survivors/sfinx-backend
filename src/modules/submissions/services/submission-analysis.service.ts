import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SortOrder } from 'src/common';
import { CacheService } from '../../redis';
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

interface AggregateRow {
  averageRuntime: string | null;
  averageMemory: string | null;
  fastestRuntime: string | null;
  lowestMemory: string | null;
  maxRuntime: string | null;
  maxMemory: string | null;
  runtimeTotal: string;
  memoryTotal: string;
}

interface BucketRow {
  bucket: number;
  count: string;
  bucketMin: string;
  bucketMax: string;
}

/** Cached problem-level aggregates (excludes per-submission percentile) */
interface CachedAggregates {
  averageRuntime: number | null;
  averageMemory: number | null;
  fastestRuntime: number | null;
  lowestMemory: number | null;
  maxRuntime: number | null;
  maxMemory: number | null;
  distribution?: {
    runtime: DistributionBin[];
    memory: DistributionBin[];
  };
}

const STATS_CACHE_TTL = 60;
const STATS_CACHE_PREFIX = 'submission:perf_stats';
const DISTRIBUTION_BIN_COUNT = 10;

@Injectable()
export class SubmissionAnalysisService {
  private readonly logger = new Logger(SubmissionAnalysisService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly cacheService: CacheService,
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

    return (await queryBuilder.getMany()).map(this.toRelevantSubmission);
  }

  /**
   * Calculate performance statistics for a submission compared to all accepted
   * submissions for the same problem.
   *
   * All aggregation runs inside PostgreSQL — O(1) memory.
   * Problem-level aggregates are cached for 60s via CacheService.
   * Per-submission percentile is always computed fresh.
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
    const problemId = problem.id;
    const cacheKey = `${STATS_CACHE_PREFIX}:${problemId}`;

    // 1. Try cache for problem-level aggregates
    const cached = await this.cacheService.get<CachedAggregates>(cacheKey);

    if (cached) {
      const percentile = await this.computePercentile(
        problemId,
        runtimeMs,
        memoryKb,
      );
      return {
        averageRuntime: cached.averageRuntime,
        averageMemory: cached.averageMemory,
        fastestRuntime: cached.fastestRuntime,
        lowestMemory: cached.lowestMemory,
        percentile,
        distribution: cached.distribution,
      };
    }

    // 2. Single aggregate query: AVG / MIN / MAX / COUNT
    const agg = await this.fetchAggregates(problemId);

    const runtimeTotal = parseInt(agg.runtimeTotal, 10);
    const memoryTotal = parseInt(agg.memoryTotal, 10);

    if (runtimeTotal === 0 && memoryTotal === 0) {
      return null;
    }

    const fastestRuntime = this.parseNullableFloat(agg.fastestRuntime);
    const lowestMemory = this.parseNullableFloat(agg.lowestMemory);
    const maxRuntime = this.parseNullableFloat(agg.maxRuntime);
    const maxMemory = this.parseNullableFloat(agg.maxMemory);

    // 3. Distribution via PostgreSQL width_bucket()
    const [runtimeDist, memoryDist] = await Promise.all([
      this.fetchDistribution(
        'runtimeMs',
        problemId,
        fastestRuntime,
        maxRuntime,
      ),
      this.fetchDistribution('memoryKb', problemId, lowestMemory, maxMemory),
    ]);

    // 4. Cache problem-level aggregates (percentile excluded — per-submission)
    const toCache: CachedAggregates = {
      averageRuntime: this.parseNullableFloat(agg.averageRuntime),
      averageMemory: this.parseNullableFloat(agg.averageMemory),
      fastestRuntime,
      lowestMemory,
      maxRuntime,
      maxMemory,
      distribution: { runtime: runtimeDist, memory: memoryDist },
    };

    await this.cacheService.set(cacheKey, toCache, { ttl: STATS_CACHE_TTL });

    // 5. Compute fresh percentile for this specific submission
    const percentile = await this.computePercentile(
      problemId,
      runtimeMs,
      memoryKb,
    );

    return {
      averageRuntime: toCache.averageRuntime,
      averageMemory: toCache.averageMemory,
      fastestRuntime,
      lowestMemory,
      percentile,
      distribution: toCache.distribution,
    };
  }

  /**
   * Get top performers for a problem
   */
  async getTopPerformers(
    problemId: number,
    limit: number = 10,
  ): Promise<RelevantSubmission[]> {
    return (
      await this.submissionRepository
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
        .getMany()
    ).map(this.toRelevantSubmission);
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
      sub1.runtimeMs != null && sub2.runtimeMs != null
        ? sub1.runtimeMs - sub2.runtimeMs
        : null;

    const memoryDiff =
      sub1.memoryKb != null && sub2.memoryKb != null
        ? sub1.memoryKb - sub2.memoryKb
        : null;

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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Single-pass streaming aggregate — O(1) RAM in PostgreSQL */
  private async fetchAggregates(problemId: number): Promise<AggregateRow> {
    return this.submissionRepository
      .createQueryBuilder('s')
      .select([
        'AVG(s.runtimeMs)  AS "averageRuntime"',
        'AVG(s.memoryKb)   AS "averageMemory"',
        'MIN(s.runtimeMs)  AS "fastestRuntime"',
        'MIN(s.memoryKb)   AS "lowestMemory"',
        'MAX(s.runtimeMs)  AS "maxRuntime"',
        'MAX(s.memoryKb)   AS "maxMemory"',
        'COUNT(s.runtimeMs) AS "runtimeTotal"',
        'COUNT(s.memoryKb)  AS "memoryTotal"',
      ])
      .where('s.problem.id = :problemId', { problemId })
      .andWhere('s.status = :status', { status: SubmissionStatus.ACCEPTED })
      .getRawOne() as Promise<AggregateRow>;
  }

  /** Lightweight COUNT FILTER query for per-submission percentile */
  private async computePercentile(
    problemId: number,
    runtimeMs: number | null,
    memoryKb: number | null,
  ): Promise<{ runtime: number | null; memory: number | null }> {
    const row = (await this.submissionRepository
      .createQueryBuilder('s')
      .select([
        'COUNT(*) FILTER (WHERE s.runtimeMs < :runtimeMs) AS "runtimeBetterCount"',
        'COUNT(*) FILTER (WHERE s.memoryKb  < :memoryKb)  AS "memoryBetterCount"',
        'COUNT(s.runtimeMs) AS "runtimeTotal"',
        'COUNT(s.memoryKb)  AS "memoryTotal"',
      ])
      .where('s.problem.id = :problemId', { problemId })
      .andWhere('s.status = :status', { status: SubmissionStatus.ACCEPTED })
      .setParameters({
        runtimeMs: runtimeMs ?? -1,
        memoryKb: memoryKb ?? -1,
      })
      .getRawOne()) as {
      runtimeBetterCount: string;
      memoryBetterCount: string;
      runtimeTotal: string;
      memoryTotal: string;
    };

    const runtimeTotal = parseInt(row.runtimeTotal, 10);
    const memoryTotal = parseInt(row.memoryTotal, 10);

    return {
      runtime:
        runtimeMs != null && runtimeTotal > 0
          ? Math.round(
              (parseInt(row.runtimeBetterCount, 10) / runtimeTotal) * 100,
            )
          : null,
      memory:
        memoryKb != null && memoryTotal > 0
          ? Math.round(
              (parseInt(row.memoryBetterCount, 10) / memoryTotal) * 100,
            )
          : null,
    };
  }

  /** Build a 10-bin histogram via PostgreSQL width_bucket() */
  private async fetchDistribution(
    column: 'runtimeMs' | 'memoryKb',
    problemId: number,
    minVal: number | null,
    maxVal: number | null,
  ): Promise<DistributionBin[]> {
    if (minVal == null || maxVal == null) return [];

    if (minVal === maxVal) {
      const { total } = (await this.submissionRepository
        .createQueryBuilder('s')
        .select('COUNT(*) AS total')
        .where('s.problem.id = :problemId', { problemId })
        .andWhere('s.status = :status', { status: SubmissionStatus.ACCEPTED })
        .andWhere(`s.${column} IS NOT NULL`)
        .getRawOne()) as { total: string };

      return [
        {
          bin: `${minVal.toFixed(2)}`,
          count: parseInt(total, 10),
          min: minVal,
          max: maxVal,
        },
      ];
    }

    const upperBound = maxVal + 0.001;
    const binCount = DISTRIBUTION_BIN_COUNT;

    const rows: BucketRow[] = await this.submissionRepository
      .createQueryBuilder('s')
      .select([
        `width_bucket(s.${column}, :minVal, :upperBound, :binCount) AS bucket`,
        'COUNT(*)       AS count',
        `MIN(s.${column}) AS "bucketMin"`,
        `MAX(s.${column}) AS "bucketMax"`,
      ])
      .where('s.problem.id = :problemId', { problemId })
      .andWhere('s.status = :status', { status: SubmissionStatus.ACCEPTED })
      .andWhere(`s.${column} IS NOT NULL`)
      .setParameters({ problemId, minVal, upperBound, binCount })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    const binWidth = (maxVal - minVal) / binCount;
    const bins: DistributionBin[] = Array.from(
      { length: binCount },
      (_, i) => ({
        bin: `${(minVal + i * binWidth).toFixed(1)}-${(minVal + (i + 1) * binWidth).toFixed(1)}`,
        min: minVal + i * binWidth,
        max: minVal + (i + 1) * binWidth,
        count: 0,
      }),
    );

    for (const row of rows) {
      const idx = Math.min(row.bucket - 1, binCount - 1);
      if (idx >= 0) {
        bins[idx].count = parseInt(row.count, 10);
        bins[idx].min = parseFloat(row.bucketMin);
        bins[idx].max = parseFloat(row.bucketMax);
      }
    }

    return bins;
  }

  private parseNullableFloat(value: string | null): number | null {
    return value != null ? parseFloat(value) : null;
  }

  private toRelevantSubmission = (s: Submission): RelevantSubmission => ({
    id: s.id,
    userId: s.user.id,
    username: s.user.username,
    runtimeMs: s.runtimeMs,
    memoryKb: s.memoryKb,
    languageName: s.language.name,
    submittedAt: s.submittedAt,
  });
}
