import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';

import { SortOrder } from 'src/common';
import { FilterSubmissionDto } from '../dto/filter-submission.dto';
import { Submission } from '../entities/submission.entity';
import { SubmissionStatus } from '../enums';

/**
 * Service for building complex submission queries
 * Follows DRY and KISS principles by extracting query logic
 * Implements fluent interface for readable query construction
 */
@Injectable()
export class SubmissionQueryBuilderService {
  /**
   * Build a base query with common joins
   */
  buildBaseQuery(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): SelectQueryBuilder<Submission> {
    return queryBuilder
      .leftJoinAndSelect('submission.problem', 'problem')
      .leftJoinAndSelect('submission.language', 'language')
      .leftJoinAndSelect('submission.user', 'user')
      .leftJoinAndSelect('submission.contest', 'contest');
  }

  /**
   * Apply user filter to query
   */
  applyUserFilter(
    queryBuilder: SelectQueryBuilder<Submission>,
    userId?: number,
  ): SelectQueryBuilder<Submission> {
    if (userId) {
      queryBuilder.andWhere('submission.user.id = :userId', { userId });
    }
    return queryBuilder;
  }

  /**
   * Apply all filters from FilterSubmissionDto
   */
  applyFilters(
    queryBuilder: SelectQueryBuilder<Submission>,
    filterDto: FilterSubmissionDto,
  ): SelectQueryBuilder<Submission> {
    const {
      problemId,
      languageId,
      status,
      userId,
      contestId,
      fromDate,
      toDate,
      minRuntimeMs,
      maxRuntimeMs,
      minMemoryKb,
      maxMemoryKb,
      acceptedOnly,
    } = filterDto;

    // Basic filters
    if (problemId) {
      queryBuilder.andWhere('submission.problem.id = :problemId', {
        problemId,
      });
    }

    if (languageId) {
      queryBuilder.andWhere('submission.language.id = :languageId', {
        languageId,
      });
    }

    if (status) {
      queryBuilder.andWhere('submission.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('submission.user.id = :userId', { userId });
    }

    if (contestId) {
      queryBuilder.andWhere('submission.contest.id = :contestId', {
        contestId,
      });
    }

    // Accepted only filter
    if (acceptedOnly) {
      queryBuilder.andWhere('submission.status = :acceptedStatus', {
        acceptedStatus: SubmissionStatus.ACCEPTED,
      });
    }

    // Date range filters
    this.applyDateFilters(queryBuilder, fromDate, toDate);

    // Performance filters
    this.applyPerformanceFilters(queryBuilder, {
      minRuntimeMs,
      maxRuntimeMs,
      minMemoryKb,
      maxMemoryKb,
    });

    return queryBuilder;
  }

  /**
   * Apply date range filters
   */
  private applyDateFilters(
    queryBuilder: SelectQueryBuilder<Submission>,
    fromDate?: Date,
    toDate?: Date,
  ): void {
    if (fromDate) {
      queryBuilder.andWhere('submission.submittedAt >= :fromDate', {
        fromDate,
      });
    }

    if (toDate) {
      queryBuilder.andWhere('submission.submittedAt <= :toDate', { toDate });
    }
  }

  /**
   * Apply performance filters (runtime and memory)
   */
  private applyPerformanceFilters(
    queryBuilder: SelectQueryBuilder<Submission>,
    filters: {
      minRuntimeMs?: number;
      maxRuntimeMs?: number;
      minMemoryKb?: number;
      maxMemoryKb?: number;
    },
  ): void {
    const { minRuntimeMs, maxRuntimeMs, minMemoryKb, maxMemoryKb } = filters;

    if (minRuntimeMs !== undefined) {
      queryBuilder.andWhere('submission.runtimeMs >= :minRuntimeMs', {
        minRuntimeMs,
      });
    }

    if (maxRuntimeMs !== undefined) {
      queryBuilder.andWhere('submission.runtimeMs <= :maxRuntimeMs', {
        maxRuntimeMs,
      });
    }

    if (minMemoryKb !== undefined) {
      queryBuilder.andWhere('submission.memoryKb >= :minMemoryKb', {
        minMemoryKb,
      });
    }

    if (maxMemoryKb !== undefined) {
      queryBuilder.andWhere('submission.memoryKb <= :maxMemoryKb', {
        maxMemoryKb,
      });
    }
  }

  /**
   * Apply sorting to query
   */
  applySorting(
    queryBuilder: SelectQueryBuilder<Submission>,
    sortBy: string = 'submittedAt',
    sortOrder: SortOrder = SortOrder.DESC,
  ): SelectQueryBuilder<Submission> {
    return queryBuilder.orderBy(`submission.${sortBy}`, sortOrder);
  }

  /**
   * Apply pagination to query
   */
  applyPagination(
    queryBuilder: SelectQueryBuilder<Submission>,
    skip: number,
    take: number,
  ): SelectQueryBuilder<Submission> {
    return queryBuilder.skip(skip).take(take);
  }

  /**
   * Build complete query with all filters, sorting, and pagination
   */
  buildCompleteQuery(
    queryBuilder: SelectQueryBuilder<Submission>,
    filterDto: FilterSubmissionDto,
    userId?: number,
  ): SelectQueryBuilder<Submission> {
    this.buildBaseQuery(queryBuilder);
    this.applyUserFilter(queryBuilder, userId);
    this.applyFilters(queryBuilder, filterDto);
    this.applySorting(queryBuilder, filterDto.sortBy, filterDto.sortOrder);
    this.applyPagination(queryBuilder, filterDto.skip, filterDto.take);

    return queryBuilder;
  }
}
