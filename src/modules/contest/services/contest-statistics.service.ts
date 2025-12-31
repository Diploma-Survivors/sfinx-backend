import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Submission } from '../../submissions/entities/submission.entity';
import { SubmissionStatus } from '../../submissions/enums';
import {
  ContestProblemStatsDto,
  ContestStatisticsDto,
  ContestStatusDistributionDto,
} from '../dto/contest-statistics.dto';
import { Contest, ContestParticipant, ContestProblem } from '../entities';

@Injectable()
export class ContestStatisticsService {
  private readonly logger = new Logger(ContestStatisticsService.name);

  constructor(
    @InjectRepository(Contest)
    private readonly contestRepository: Repository<Contest>,
    @InjectRepository(ContestParticipant)
    private readonly participantRepository: Repository<ContestParticipant>,
    @InjectRepository(ContestProblem)
    private readonly contestProblemRepository: Repository<ContestProblem>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  /**
   * Get comprehensive statistics for a contest
   */
  async getContestStatistics(contestId: number): Promise<ContestStatisticsDto> {
    // Verify contest exists and get basic info
    const contest = await this.contestRepository.findOne({
      where: { id: contestId },
      select: ['id', 'title', 'status', 'startTime', 'endTime'],
    });

    if (!contest) {
      throw new NotFoundException(`Contest with ID ${contestId} not found`);
    }

    // Build base query for contest submissions
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .where('submission.contest.id = :contestId', { contestId });

    // Get aggregate statistics in parallel
    const [
      totalRegistered,
      totalParticipants,
      totalSubmissions,
      totalAccepted,
      statusDistribution,
      problemStats,
    ] = await Promise.all([
      this.getTotalRegistered(contestId),
      this.getTotalParticipants(queryBuilder.clone()),
      this.getTotalSubmissions(queryBuilder.clone()),
      this.getTotalAccepted(queryBuilder.clone()),
      this.getStatusDistribution(queryBuilder.clone()),
      this.getProblemStats(contestId),
    ]);

    // Calculate acceptance rate
    const acceptanceRate =
      totalSubmissions > 0
        ? Number(((totalAccepted / totalSubmissions) * 100).toFixed(2))
        : 0;

    // Add percentages to status distribution
    const statusDistributionWithPercentage = statusDistribution.map((item) => ({
      ...item,
      percentage:
        totalSubmissions > 0
          ? Number(((item.count / totalSubmissions) * 100).toFixed(2))
          : 0,
    }));

    return {
      contestId: contest.id,
      contestName: contest.title,
      status: contest.status,
      startTime: contest.startTime.toISOString(),
      endTime: contest.endTime.toISOString(),
      totalRegistered,
      totalParticipants,
      totalSubmissions,
      totalAccepted,
      acceptanceRate,
      statusDistribution: statusDistributionWithPercentage,
      problemStats,
    };
  }

  /**
   * Get total registered users count
   */
  private async getTotalRegistered(contestId: number): Promise<number> {
    return this.participantRepository.count({
      where: { contest: { id: contestId } },
    });
  }

  /**
   * Get count of users who submitted at least once
   */
  private async getTotalParticipants(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<number> {
    const result = await queryBuilder
      .select('COUNT(DISTINCT submission.user.id)', 'count')
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
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
   * Get distribution of submission statuses
   */
  private async getStatusDistribution(
    queryBuilder: SelectQueryBuilder<Submission>,
  ): Promise<ContestStatusDistributionDto[]> {
    const results = await queryBuilder
      .select(['submission.status as status', 'COUNT(*) as count'])
      .groupBy('submission.status')
      .orderBy('count', 'DESC')
      .getRawMany<{ status: string; count: string }>();

    return results.map((row) => ({
      status: row.status as SubmissionStatus,
      count: parseInt(row.count, 10),
      percentage: 0, // Will be calculated later
    }));
  }

  /**
   * Get per-problem statistics
   */
  private async getProblemStats(
    contestId: number,
  ): Promise<ContestProblemStatsDto[]> {
    // Get contest problems with ordering
    const contestProblems = await this.contestProblemRepository.find({
      where: { contest: { id: contestId } },
      relations: ['problem'],
      order: { orderIndex: 'ASC' },
    });

    // Get total participants (users who submitted at least once)
    const totalParticipants = await this.submissionRepository
      .createQueryBuilder('submission')
      .where('submission.contest.id = :contestId', { contestId })
      .select('COUNT(DISTINCT submission.user.id)', 'count')
      .getRawOne<{ count: string }>()
      .then((result) => parseInt(result?.count ?? '0', 10));

    // Get statistics for each problem
    const problemStats = await Promise.all(
      contestProblems.map(async (cp) => {
        const queryBuilder = this.submissionRepository
          .createQueryBuilder('submission')
          .where('submission.contest.id = :contestId', { contestId })
          .andWhere('submission.problem.id = :problemId', {
            problemId: cp.problem.id,
          });

        const [totalSubmissions, solvedCount] = await Promise.all([
          queryBuilder.clone().getCount(),
          queryBuilder
            .clone()
            .andWhere('submission.status = :status', {
              status: SubmissionStatus.ACCEPTED,
            })
            .select('COUNT(DISTINCT submission.user.id)', 'count')
            .getRawOne<{ count: string }>()
            .then((result) => parseInt(result?.count ?? '0', 10)),
        ]);

        const solvedPercentage =
          totalParticipants > 0
            ? Number(((solvedCount / totalParticipants) * 100).toFixed(2))
            : 0;

        return {
          problemId: cp.problem.id,
          problemOrder: cp.orderIndex,
          problemLabel: cp.label ?? 'N/A',
          totalSubmissions,
          solvedCount,
          solvedPercentage,
        };
      }),
    );

    return problemStats;
  }
}
