import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResultDto } from '../../../common';
import { Submission } from '../entities/submission.entity';
import { FilterSubmissionDto } from '../dto/filter-submission.dto';
import {
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from '../dto/submission-response.dto';
import { SubmissionMapper } from '../mappers/submission.mapper';
import { SubmissionQueryBuilderService } from './submission-query-builder.service';
import { StorageService } from '../../storage/storage.service';

/**
 * Service responsible for retrieving submissions
 * Follows Single Responsibility Principle
 * Separates read operations from write operations
 */
@Injectable()
export class SubmissionRetrievalService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly queryBuilder: SubmissionQueryBuilderService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Get submissions with filtering and pagination
   */
  async getSubmissions(
    filterDto: FilterSubmissionDto,
    userId?: number,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    const queryBuilder =
      this.submissionRepository.createQueryBuilder('submission');

    this.queryBuilder.buildCompleteQuery(queryBuilder, filterDto, userId);

    const [submissions, total] = await queryBuilder.getManyAndCount();
    const data = SubmissionMapper.toListResponseDtos(
      submissions,
      this.storageService,
    );

    return new PaginatedResultDto(data, {
      page: filterDto.page ?? 1,
      limit: filterDto.limit ?? 20,
      total,
    });
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(
    id: number,
    userId?: number,
    includeSourceCode = false,
  ): Promise<SubmissionResponseDto> {
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .where('submission.id = :id', { id });

    this.queryBuilder.buildBaseQuery(queryBuilder);

    if (userId) {
      queryBuilder.andWhere('submission.user.id = :userId', { userId });
    }

    const submission = await queryBuilder.getOne();

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    const isOwner = submission.user?.id === userId;

    return SubmissionMapper.toResponseDto(submission, {
      includeSourceCode: includeSourceCode && isOwner,
      includeUser: !userId,
      storageService: this.storageService,
    });
  }

  /**
   * Find submission entity by ID (for internal use)
   */
  async findSubmissionEntity(
    id: number,
    relations: string[] = ['user', 'problem', 'language'],
  ): Promise<Submission | null> {
    return this.submissionRepository.findOne({
      where: { id },
      relations,
    });
  }

  /**
   * Get user's recent submissions for a specific problem
   */
  async getUserRecentSubmissionsForProblem(
    userId: number,
    problemId: number,
    limit: number = 10,
  ): Promise<Submission[]> {
    return this.submissionRepository.find({
      where: {
        user: { id: userId },
        problem: { id: problemId },
      },
      relations: ['language'],
      order: { submittedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Count total submissions for a user
   */
  async countUserSubmissions(userId: number): Promise<number> {
    return this.submissionRepository.count({
      where: { user: { id: userId } },
    });
  }

  /**
   * Count total submissions for a problem
   */
  async countProblemSubmissions(problemId: number): Promise<number> {
    return this.submissionRepository.count({
      where: { problem: { id: problemId } },
    });
  }
}
