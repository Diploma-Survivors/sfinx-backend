import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResultDto } from '../../../common';
import { FilterSubmissionDto } from '../../submissions/dto/filter-submission.dto';
import { SubmissionListResponseDto } from '../../submissions/dto/submission-response.dto';
import { Submission } from '../../submissions/entities/submission.entity';
import { SubmissionMapper } from '../../submissions/mappers/submission.mapper';
import { ContestProblem } from '../entities/contest-problem.entity';
import { ContestStatus } from '../enums/contest-status.enum';
import { ContestLeaderboardService } from './contest-leaderboard.service';
import { ContestService } from './contest.service';
import { SubmissionAcceptedEvent } from '../../submissions/events/submission.events';
import { SubmissionRetrievalService } from '../../submissions/services';

@Injectable()
export class ContestSubmissionService {
  private readonly logger = new Logger(ContestSubmissionService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(ContestProblem)
    private readonly contestProblemRepository: Repository<ContestProblem>,
    private readonly contestService: ContestService,
    private readonly leaderboardService: ContestLeaderboardService,
    private readonly retrievalService: SubmissionRetrievalService,
  ) {}

  /**
   * Validate that a submission can be made to a contest
   */
  async validateSubmission(
    contestId: number,
    userId: number,
    problemId: number,
  ): Promise<void> {
    // Check contest exists and is running
    const contest = await this.contestService.getContestById(contestId);

    if (contest.status !== ContestStatus.RUNNING) {
      throw new BadRequestException(
        'Submissions are only allowed during running contests',
      );
    }

    // Check user is registered
    const isRegistered = await this.contestService.isUserRegistered(
      contestId,
      userId,
    );
    if (!isRegistered) {
      throw new ForbiddenException('You must register for this contest first');
    }

    // Check problem is part of contest
    const contestProblem = await this.contestProblemRepository.findOne({
      where: { contestId, problemId },
    });
    if (!contestProblem) {
      throw new BadRequestException('Problem is not part of this contest');
    }
  }

  /**
   * Create contest submission (marks it with contestId)
   * This is called by SubmissionsService to set the contest relation
   */
  async markSubmissionAsContest(
    submissionId: number,
    contestId: number,
  ): Promise<void> {
    await this.submissionRepository.update(submissionId, { contestId });
    this.logger.debug(
      `Marked submission ${submissionId} as contest ${contestId}`,
    );
  }

  /**
   * Get user's submissions for a specific contest
   */
  async getUserContestSubmissions(
    contestId: number,
    userId: number,
    filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    filterDto.contestId = contestId;
    filterDto.userId = userId;
    return this.retrievalService.getSubmissions(filterDto, userId);
  }

  /**
   * Handle submission result and update leaderboard
   * Called when a contest submission is judged
   */
  async handleSubmissionResult(event: SubmissionAcceptedEvent): Promise<void> {
    // Get submission with contest info
    const submission = await this.submissionRepository.findOne({
      where: { id: event.submissionId },
      relations: ['user', 'problem'],
    });

    if (!submission || !submission.contestId) {
      return; // Not a contest submission
    }

    // Update participant score and leaderboard
    await this.leaderboardService.updateParticipantScore(
      submission.contestId,
      submission.userId,
      submission.problem.id,
    );

    this.logger.debug(
      `Processed contest submission ${submission.id}: updated leaderboard for contest ${submission.contestId}`,
    );
  }

  /**
   * Get all submissions for a contest (admin view)
   */
  async getContestSubmissions(
    contestId: number,
    filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.problem', 'problem')
      .leftJoinAndSelect('submission.language', 'language')
      .leftJoinAndSelect('submission.user', 'user')
      .where('submission.contestId = :contestId', { contestId });

    // Apply filters
    if (filterDto.problemId) {
      queryBuilder.andWhere('submission.problem.id = :problemId', {
        problemId: filterDto.problemId,
      });
    }

    if (filterDto.userId) {
      queryBuilder.andWhere('submission.user.id = :userId', {
        userId: filterDto.userId,
      });
    }

    if (filterDto.status) {
      queryBuilder.andWhere('submission.status = :status', {
        status: filterDto.status,
      });
    }

    // Apply sorting
    const sortBy = filterDto.sortBy || 'submittedAt';
    const sortOrder = filterDto.sortOrder || 'DESC';
    queryBuilder.orderBy(`submission.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip(filterDto.skip).take(filterDto.take);

    const [submissions, total] = await queryBuilder.getManyAndCount();

    const data = SubmissionMapper.toListResponseDtos(submissions);

    return new PaginatedResultDto(data, {
      page: filterDto.page ?? 1,
      limit: filterDto.limit ?? 20,
      total,
    });
  }
}
