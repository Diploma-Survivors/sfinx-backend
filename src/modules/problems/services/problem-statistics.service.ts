import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Submission } from '../../submissions/entities/submission.entity';
import { SubmissionStatus } from '../../submissions/enums/submission-status.enum';
import {
  LanguageBreakdownDto,
  ProblemStatisticsDto,
  StatusDistributionDto,
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
    const [totalSubmissions, totalAccepted, uniqueUsers, uniqueSolvers] =
      await Promise.all([
        this.getTotalSubmissions(queryBuilder.clone()),
        this.getTotalAccepted(queryBuilder.clone()),
        this.getUniqueUsers(queryBuilder.clone()),
        this.getUniqueSolvers(queryBuilder.clone()),
      ]);

    // Calculate acceptance rate
    const acceptanceRate =
      totalSubmissions > 0
        ? Number(((totalAccepted / totalSubmissions) * 100).toFixed(2))
        : 0;

    // Get language breakdown
    const languageBreakdown = await this.getLanguageBreakdown(
      queryBuilder.clone(),
    );

    // Get status distribution
    const statusDistribution = await this.getStatusDistribution(
      queryBuilder.clone(),
      totalSubmissions,
    );

    return {
      problemId: problem.id,
      problemTitle: problem.title,
      totalSubmissions,
      totalAccepted,
      acceptanceRate,
      uniqueUsers,
      uniqueSolvers,
      languageBreakdown,
      statusDistribution,
    };
  }

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
   * Get submission breakdown by programming language
   */
  private async getLanguageBreakdown(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<LanguageBreakdownDto[]> {
    const results = await queryBuilder
      .leftJoin('submission.language', 'language')
      .select([
        'language.id as languageId',
        'language.name as languageName',
        'COUNT(*) as submissionCount',
        `SUM(CASE WHEN submission.status = '${SubmissionStatus.ACCEPTED}' THEN 1 ELSE 0 END) as acceptedCount`,
      ])
      .groupBy('language.id')
      .addGroupBy('language.name')
      .orderBy('submissionCount', 'DESC')
      .limit(10) // Top 10 languages
      .getRawMany<{
        languageid: string;
        languagename: string;
        submissioncount: string;
        acceptedcount: string;
      }>();

    return results.map((row) => ({
      languageId: parseInt(row.languageid, 10),
      languageName: row.languagename,
      submissionCount: parseInt(row.submissioncount, 10),
      acceptedCount: parseInt(row.acceptedcount, 10),
    }));
  }

  /**
   * Get distribution of submission statuses
   */
  private async getStatusDistribution(
    queryBuilder: SelectQueryBuilder<Submission>,
    totalSubmissions: number,
  ): Promise<StatusDistributionDto[]> {
    const results = await queryBuilder
      .select(['submission.status as status', 'COUNT(*) as count'])
      .groupBy('submission.status')
      .orderBy('count', 'DESC')
      .getRawMany<{ status: string; count: string }>();

    return results.map((row) => {
      const count = parseInt(row.count, 10);
      return {
        status: row.status as SubmissionStatus,
        count,
        percentage:
          totalSubmissions > 0
            ? Number(((count / totalSubmissions) * 100).toFixed(2))
            : 0,
      };
    });
  }
}
