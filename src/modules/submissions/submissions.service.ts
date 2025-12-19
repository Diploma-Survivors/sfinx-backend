import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';

import { PaginatedResultDto } from '../../common';
import { Judge0BatchResponse } from '../judge0/interfaces';
import { Judge0Service } from '../judge0/judge0.service';
import { Problem } from '../problems/entities/problem.entity';
import { ProblemsService } from '../problems/problems.service';
import { ProgrammingLanguageService } from '../programming-language';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilterSubmissionDto } from './dto/filter-submission.dto';
import { SubmissionResponseDto } from './dto/submission-response.dto';
import { Submission } from './entities/submission.entity';
import { SubmissionStatus } from './enums/submission-status.enum';
import type { TestCaseResult } from './interfaces/testcase-result.interface';
import { SubmissionMapper } from './mappers/submission.mapper';
import {
  Judge0PayloadBuilderService,
  SubmissionTrackerService,
  UserProgressService,
  UserStatisticsService,
} from './services';

/**
 * Main service for managing code submissions
 * Orchestrates workflow using focused services following SOLID principles
 */
@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly problemsService: ProblemsService,
    private readonly judge0Service: Judge0Service,
    private readonly languagesService: ProgrammingLanguageService,
    private readonly payloadBuilder: Judge0PayloadBuilderService,
    private readonly submissionTracker: SubmissionTrackerService,
    private readonly userProgress: UserProgressService,
    private readonly userStatistics: UserStatisticsService,
  ) {}

  /**
   * Run code for testing (without saving submission)
   */
  async executeTestRun(
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<{ submissionId: string }> {
    const { problemId, languageId, sourceCode, testCases } =
      createSubmissionDto;

    const problem = await this.problemsService.getProblemById(problemId);
    const language = await this.languagesService.findById(languageId);

    const submissionId = uuidV4();

    return this.submitBatch(
      submissionId,
      language.judge0Id,
      sourceCode,
      problem,
      false,
      testCases,
    );
  }

  /**
   * Submit a solution for grading
   */
  async submitForGrading(
    createSubmissionDto: CreateSubmissionDto,
    userId: number,
    ipAddress?: string,
  ): Promise<{ submissionId: string }> {
    const { problemId, languageId, sourceCode } = createSubmissionDto;

    // Verify problem and language exist
    const problem = await this.problemsService.getProblemById(problemId);
    const language = await this.languagesService.findById(languageId);

    // Check if problem has testcases
    if (!problem.testcaseFileKey) {
      throw new BadRequestException('Problem has no testcases');
    }

    // Create submission record
    const submission = this.submissionRepository.create({
      user: { id: userId },
      problem: { id: problemId },
      language: { id: languageId },
      sourceCode,
      status: SubmissionStatus.PENDING,
      totalTestcases: problem.testcaseCount,
      passedTestcases: 0,
      ipAddress,
    });

    const savedSubmission = await this.submissionRepository.save(submission);

    // Update user progress
    await this.userProgress.updateProgressOnSubmit(
      userId,
      problemId,
      savedSubmission,
    );

    return this.submitBatch(
      savedSubmission.id.toString(),
      language.judge0Id,
      sourceCode,
      problem,
      true,
    );
  }

  /**
   * Submit batch of testcases to Judge0
   */
  private async submitBatch(
    submissionId: string,
    judge0LanguageId: number,
    sourceCode: string,
    problem: Problem,
    isSubmit: boolean,
    testcases?: CreateSubmissionDto['testCases'],
  ): Promise<{ submissionId: string }> {
    // Validate testcases for run mode
    if (!isSubmit && (!testcases || testcases.length === 0)) {
      throw new Error(
        'testCases must be a non-empty array when not using testcase file.',
      );
    }

    // Build Judge0 payloads
    const items = isSubmit
      ? await this.payloadBuilder.buildPayloadsForSubmit(
          submissionId,
          sourceCode,
          judge0LanguageId,
          problem,
        )
      : this.payloadBuilder.buildPayloadsForTest(
          submissionId,
          sourceCode,
          judge0LanguageId,
          problem,
          testcases!,
        );

    if (items.length === 0) {
      throw new Error('No testcases found for submission.');
    }

    // Submit to Judge0
    const judge0BatchResponse: Judge0BatchResponse =
      await this.judge0Service.createSubmissionBatch(items);

    // Verify response
    if (judge0BatchResponse.length !== items.length) {
      throw new Error(
        `Judge0 returned ${judge0BatchResponse.length} tokens, expected ${items.length}. submissionId=${submissionId}`,
      );
    }

    // Initialize Redis tracking
    await this.submissionTracker.initializeTracking(
      submissionId,
      items.length,
      problem.id,
    );

    return { submissionId };
  }

  /**
   * Get submissions with filtering and pagination
   */
  async getSubmissions(
    filterDto: FilterSubmissionDto,
    userId?: number,
  ): Promise<PaginatedResultDto<SubmissionResponseDto>> {
    const { problemId, languageId, status } = filterDto;

    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.problem', 'problem')
      .leftJoinAndSelect('submission.language', 'language')
      .leftJoinAndSelect('submission.user', 'user');

    // Filter by user if userId provided
    if (userId) {
      queryBuilder.andWhere('submission.user.id = :userId', { userId });
    }

    // Apply filters
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

    // Apply sorting
    const sortBy = filterDto.sortBy || 'submittedAt';
    const sortOrder = filterDto.sortOrder || 'DESC';
    queryBuilder.orderBy(`submission.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip(filterDto.skip).take(filterDto.take);

    // Get data and count
    const [submissions, total] = await queryBuilder.getManyAndCount();

    // Map to response DTOs
    const data = submissions.map((s) => SubmissionMapper.toResponseDto(s));

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
  ): Promise<SubmissionResponseDto> {
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.problem', 'problem')
      .leftJoinAndSelect('submission.language', 'language')
      .leftJoinAndSelect('submission.user', 'user')
      .where('submission.id = :id', { id });

    // Filter by user if provided
    if (userId) {
      queryBuilder.andWhere('submission.user.id = :userId', { userId });
    }

    const submission = await queryBuilder.getOne();

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    return SubmissionMapper.toResponseDto(submission);
  }

  /**
   * Get all submissions for current user
   */
  async getUserSubmissions(
    userId: number,
    filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionResponseDto>> {
    return this.getSubmissions(filterDto, userId);
  }

  /**
   * Update submission result (called when Judge0 returns results)
   */
  async updateSubmissionResult(
    id: number,
    status: SubmissionStatus,
    testcaseResults: TestCaseResult[],
    runtimeMs?: number,
    memoryKb?: number,
    errorMessage?: string,
    compileOutput?: string,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['user', 'problem'],
    });

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    // Calculate passed testcases
    const passedTestcases = testcaseResults.filter(
      (tc) => tc.status === 'Accepted',
    ).length;

    // Update submission
    submission.status = status;
    submission.resultDescription = {
      input: testcaseResults.at(-1)?.input,
      actualOutput: testcaseResults.at(-1)?.actualOutput,
      expectedOutput: testcaseResults.at(-1)?.expectedOutput,
      message: errorMessage ?? '',
      compileOutput,
    };
    submission.passedTestcases = passedTestcases;
    submission.runtimeMs = runtimeMs ?? null;
    submission.memoryKb = memoryKb ?? null;
    submission.judgedAt = new Date();

    const updatedSubmission = await this.submissionRepository.save(submission);

    // Update problem statistics
    await this.updateProblemStatistics(submission.problem.id, status);

    // Update user progress
    await this.userProgress.updateProgressAfterJudge(
      submission.user.id,
      submission.problem.id,
      submission.id,
      status,
      runtimeMs,
      memoryKb,
    );

    return updatedSubmission;
  }

  /**
   * Get user's progress on a specific problem
   */
  async getUserProblemProgress(userId: number, problemId: number) {
    return this.userProgress.getUserProgress(userId, problemId);
  }

  /**
   * Get all problem progress for a user
   */
  async getUserAllProgress(userId: number) {
    return this.userProgress.getAllUserProgress(userId);
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId: number) {
    return this.userStatistics.getUserStatistics(userId);
  }

  /**
   * Update problem statistics (private helper)
   */
  private async updateProblemStatistics(
    problemId: number,
    status: SubmissionStatus,
  ): Promise<void> {
    const problem = await this.problemsService.getProblemById(problemId);

    problem.totalSubmissions += 1;

    if (status === SubmissionStatus.ACCEPTED) {
      problem.totalAccepted += 1;
    }

    // Calculate acceptance rate
    if (problem.totalSubmissions > 0) {
      problem.acceptanceRate = Number(
        ((problem.totalAccepted / problem.totalSubmissions) * 100).toFixed(2),
      );
    }

    await this.problemsService.updateProblemStats(problemId);
  }
}
