import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';

import { PaginatedResultDto, PaginationQueryDto } from '../../common';
import { Judge0BatchResponse } from '../judge0/interfaces';
import { Judge0Service } from '../judge0/judge0.service';
import { Problem } from '../problems/entities/problem.entity';
import { ProblemsService } from '../problems/problems.service';
import { ProgrammingLanguageService } from '../programming-language';
import { SUBMISSION_EVENTS } from './constants/submission-events.constants';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilterSubmissionDto } from './dto/filter-submission.dto';
import {
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from './dto/submission-response.dto';
import { UserPracticeHistoryDto } from './dto/user-practice-history.dto';
import { UserStatisticsDto } from './dto/user-statistics.dto';
import { Submission } from './entities/submission.entity';
import { ProgressStatus } from './enums/progress-status.enum';
import { SubmissionStatus } from './enums/submission-status.enum';
import { ResultDescription } from './interfaces/result-description.interface';
import {
  ProblemSolvedEvent,
  SubmissionAcceptedEvent,
  SubmissionCreatedEvent,
  SubmissionJudgedEvent,
} from './events/submission.events';
import {
  Judge0PayloadBuilderService,
  SubmissionTrackerService,
  UserProgressService,
  UserStatisticsService,
} from './services';
import { SubmissionAnalysisService } from './services/submission-analysis.service';
import { SubmissionRetrievalService } from './services/submission-retrieval.service';

/**
 * Main service for managing code submissions
 */
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

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
    private readonly retrievalService: SubmissionRetrievalService,
    private readonly analysisService: SubmissionAnalysisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute test run (no database submission)
   */
  async executeTestRun(
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<{ submissionId: string }> {
    const { problemId, languageId, sourceCode, testCases } =
      createSubmissionDto;

    this.logger.log(
      `Executing test run for problem ${problemId}, language ${languageId}, testcases: ${testCases?.length || 0}`,
    );

    const problem = await this.problemsService.findProblemEntityById(problemId);
    const language = await this.languagesService.findById(languageId);

    const submissionId = uuidV4();
    this.logger.debug(`Generated submission ID: ${submissionId}`);

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
   * Submit code for grading (creates database record)
   */
  async submitForGrading(
    createSubmissionDto: CreateSubmissionDto,
    userId: number,
    ipAddress?: string,
  ): Promise<{ submissionId: string }> {
    const { problemId, languageId, sourceCode } = createSubmissionDto;

    this.logger.log(
      `User ${userId} submitting solution for problem ${problemId}, language ${languageId}`,
    );

    const problem = await this.problemsService.findProblemEntityById(problemId);
    const language = await this.languagesService.findById(languageId);

    if (!problem.testcaseFileKey) {
      throw new BadRequestException('Problem has no testcases');
    }

    const submission = await this.createSubmissionRecord(
      userId,
      problemId,
      languageId,
      sourceCode,
      problem.testcaseCount,
      ipAddress,
    );

    // Emit submission created event
    this.eventEmitter.emit(
      SUBMISSION_EVENTS.CREATED,
      new SubmissionCreatedEvent(submission.id, userId, problemId, languageId),
    );

    // Update user progress (tracks attempts)
    await this.userProgress.updateProgressOnSubmit(userId, problemId);

    return this.submitBatch(
      submission.id.toString(),
      language.judge0Id,
      sourceCode,
      problem,
      true,
    );
  }

  /**
   * Create submission database record
   */
  private async createSubmissionRecord(
    userId: number,
    problemId: number,
    languageId: number,
    sourceCode: string,
    totalTestcases: number,
    ipAddress?: string,
  ): Promise<Submission> {
    const submission = this.submissionRepository.create({
      user: { id: userId },
      problem: { id: problemId },
      language: { id: languageId },
      sourceCode,
      status: SubmissionStatus.PENDING,
      totalTestcases,
      passedTestcases: 0,
      ipAddress,
    });

    const saved = await this.submissionRepository.save(submission);
    this.logger.log(`Submission ${saved.id} created for user ${userId}`);
    return saved;
  }

  /**
   * Submit batch to Judge0 and initialize tracking
   */
  private async submitBatch(
    submissionId: string,
    judge0LanguageId: number,
    sourceCode: string,
    problem: Problem,
    isSubmit: boolean,
    testcases?: CreateSubmissionDto['testCases'],
  ): Promise<{ submissionId: string }> {
    this.logger.log(
      `[${submissionId}] Submitting batch - mode: ${isSubmit ? 'SUBMIT' : 'RUN'}`,
    );

    if (!isSubmit && (!testcases || testcases.length === 0)) {
      throw new BadRequestException('testCases required for run mode');
    }

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
      throw new BadRequestException('No testcases found');
    }

    const judge0BatchResponse: Judge0BatchResponse =
      await this.judge0Service.createSubmissionBatch(items);

    if (judge0BatchResponse.length !== items.length) {
      throw new InternalServerErrorException(
        `Judge0 token count mismatch: expected ${items.length}, got ${judge0BatchResponse.length}`,
      );
    }

    await this.submissionTracker.initializeTracking(
      submissionId,
      items.length,
      problem.id,
    );

    this.logger.log(`[${submissionId}] ✓ Batch submitted successfully`);
    return { submissionId };
  }

  /**
   * Update submission after judging (called by finalize processor)
   */
  async updateSubmissionAfterJudge(
    submissionId: number,
    status: SubmissionStatus,
    passedTestcases: number,
    totalTestcases: number,
    runtimeMs?: number,
    memoryKb?: number,
    resultDescription?: ResultDescription,
  ): Promise<void> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['user', 'problem'],
    });

    if (!submission) {
      this.logger.warn(`Submission ${submissionId} not found`);
      return;
    }

    if (submission.judgedAt !== null) {
      this.logger.log(`Submission ${submissionId} already judged`);
      return;
    }

    submission.status = status;
    submission.passedTestcases = passedTestcases;
    submission.runtimeMs = runtimeMs ?? null;
    submission.memoryKb = memoryKb ?? null;
    submission.resultDescription = resultDescription
      ? {
          ...resultDescription,
          message: resultDescription.message ?? 'Unknown Error',
        }
      : null;
    submission.judgedAt = new Date();

    await this.submissionRepository.save(submission);

    // Emit judged event (will trigger stats update via event handler)
    this.eventEmitter.emit(
      SUBMISSION_EVENTS.JUDGED,
      new SubmissionJudgedEvent(
        submissionId,
        submission.user.id,
        submission.problem.id,
        status,
        passedTestcases,
        totalTestcases,
        runtimeMs,
        memoryKb,
      ),
    );

    // Check if this is first AC
    const wasFirstSolve = await this.handleAcceptedSubmission(
      submission,
      status,
      runtimeMs,
      memoryKb,
    );

    if (wasFirstSolve) {
      this.eventEmitter.emit(
        SUBMISSION_EVENTS.PROBLEM_SOLVED,
        new ProblemSolvedEvent(
          submissionId,
          submission.user.id,
          submission.problem.id,
        ),
      );
    }

    // Invalidate cache
    await this.userStatistics.invalidateUserStatisticsCache(submission.user.id);
  }

  /**
   * Handle accepted submission logic
   * Returns true if this is first AC
   */
  private async handleAcceptedSubmission(
    submission: Submission,
    status: SubmissionStatus,
    runtimeMs?: number,
    memoryKb?: number,
  ): Promise<boolean> {
    if (status !== SubmissionStatus.ACCEPTED) {
      return false;
    }

    // Emit accepted event
    this.eventEmitter.emit(
      SUBMISSION_EVENTS.ACCEPTED,
      new SubmissionAcceptedEvent(
        submission.id,
        submission.user.id,
        submission.problem.id,
        runtimeMs,
        memoryKb,
      ),
    );

    // Check if first solve
    const progressBefore = await this.userProgress.getUserProgress(
      submission.user.id,
      submission.problem.id,
    );
    const wasFirstSolve = progressBefore?.status !== ProgressStatus.SOLVED;

    // Update progress
    await this.userProgress.updateProgressAfterJudge(
      submission.user.id,
      submission.problem.id,
      submission.id,
      status,
      runtimeMs,
      memoryKb,
    );

    return wasFirstSolve;
  }

  // ==================== Delegation Methods ====================

  /**
   * Get submissions (delegates to retrieval service)
   */
  async getSubmissions(
    filterDto: FilterSubmissionDto,
    userId?: number,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    return this.retrievalService.getSubmissions(filterDto, userId);
  }

  /**
   * Get submission by ID (delegates to retrieval service)
   */
  async getSubmissionById(
    id: number,
    userId?: number,
    includeSourceCode = false,
  ): Promise<SubmissionResponseDto> {
    return this.retrievalService.getSubmissionById(
      id,
      userId,
      includeSourceCode,
    );
  }

  /**
   * Get user submissions (delegates to retrieval service)
   */
  async getUserSubmissions(
    userId: number,
    filterDto: FilterSubmissionDto,
  ): Promise<PaginatedResultDto<SubmissionListResponseDto>> {
    return this.retrievalService.getSubmissions(filterDto, userId);
  }

  /**
   * Get user problem progress (delegates to progress service)
   */
  async getUserProblemProgress(userId: number, problemId: number) {
    return this.userProgress.getUserProgress(userId, problemId);
  }

  /**
   * Get all user progress (delegates to progress service)
   */
  async getUserAllProgress(
    userId: number,
    paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResultDto<UserPracticeHistoryDto>> {
    return this.userProgress.getAllUserProgress(userId, paginationDto);
  }

  /**
   * Get user statistics (delegates to statistics service)
   */
  async getUserStatistics(userId: number): Promise<UserStatisticsDto> {
    return this.userStatistics.getUserStatistics(userId);
  }

  /**
   * Get relevant submissions (delegates to analysis service)
   */
  async getRelevantSubmissions(
    problemId: number,
    languageId?: number,
    limit: number = 10,
  ) {
    return this.analysisService.getRelevantSubmissions(
      problemId,
      languageId,
      limit,
    );
  }

  /**
   * Get performance stats (delegates to analysis service)
   */
  async getPerformanceStats(submissionId: number) {
    return this.analysisService.calculatePerformanceStats(submissionId);
  }

  /**
   * Get top performers (delegates to analysis service)
   */
  async getTopPerformers(problemId: number, limit: number = 10) {
    return this.analysisService.getTopPerformers(problemId, limit);
  }
}
