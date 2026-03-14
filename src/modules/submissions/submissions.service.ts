import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';

import { LangChainService, PromptFeature, PromptService } from '../ai';

import { PaginatedResultDto } from '../../common';
import { Language } from '../auth/enums';
import { ContestSubmissionService } from '../contest/services';
import { Judge0BatchResponse } from '../judge0/interfaces';
import { Judge0Service } from '../judge0/judge0.service';
import { NotificationEvent } from '../notifications/enums/notification-event.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Problem } from '../problems/entities/problem.entity';
import { ProblemsService } from '../problems/problems.service';
import { ProgrammingLanguageService } from '../programming-language';
import { SUBMISSION_EVENTS } from './constants/submission-events.constants';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilterSubmissionDto } from './dto/filter-submission.dto';
import { GetPracticeHistoryDto } from './dto/get-practice-history.dto';
import {
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from './dto/submission-response.dto';
import { ResultDescriptionDto } from './dto/submission-result.dto';
import { UserPracticeHistoryDto } from './dto/user-practice-history.dto';
import { UserProblemProgressDetailResponseDto } from './dto/user-problem-progress-detail-response.dto';
import { UserStatisticsDto } from './dto/user-statistics.dto';
import { Submission } from './entities/submission.entity';
import { SubmissionStatus } from './enums';
import {
  ProblemSolvedEvent,
  SubmissionAcceptedEvent,
  SubmissionCreatedEvent,
  SubmissionJudgedEvent,
} from './events/submission.events';
import { Judge0PayloadBuilderService } from './services/judge0-payload-builder.service';
import { SubmissionAnalysisService } from './services/submission-analysis.service';
import { SubmissionRetrievalService } from './services/submission-retrieval.service';
import { SubmissionTrackerService } from './services/submission-tracker.service';
import { UserProgressService } from './services/user-progress.service';
import { UserStatisticsService } from './services/user-statistics.service';

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
    @Inject(forwardRef(() => ContestSubmissionService))
    private readonly contestSubmissionService: ContestSubmissionService,
    private readonly notificationsService: NotificationsService,
    private readonly promptService: PromptService,
    private readonly langChainService: LangChainService,
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

    return this.submitToJudge0(
      submissionId,
      language.judge0Id,
      language.slug,
      language.harnessCode,
      sourceCode,
      problem,
      false,
      testCases,
    );
  }

  /**
   * Submit practice solution (regular submission)
   */
  async submitPracticeSolution(
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

    return this.submitToJudge0(
      submission.id.toString(),
      language.judge0Id,
      language.slug,
      language.harnessCode,
      sourceCode,
      problem,
      true,
    );
  }

  /**
   * Submit contest solution
   */
  async submitContestSolution(
    createSubmissionDto: CreateSubmissionDto,
    userId: number,
    ipAddress: string,
    contestId: number,
  ): Promise<{ submissionId: string; contestId: number }> {
    const { problemId, languageId, sourceCode } = createSubmissionDto;

    // Validate contest rules (running, registered, problem part of contest)
    await this.contestSubmissionService.validateSubmission(
      contestId,
      userId,
      problemId,
    );

    this.logger.log(
      `User ${userId} submitting contest solution for problem ${problemId} in contest ${contestId}`,
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
      contestId, // Pass contestId
    );

    // Emit submission created event
    this.eventEmitter.emit(
      SUBMISSION_EVENTS.CREATED,
      new SubmissionCreatedEvent(submission.id, userId, problemId, languageId),
    );

    await this.submitToJudge0(
      submission.id.toString(),
      language.judge0Id,
      language.slug,
      language.harnessCode,
      sourceCode,
      problem,
      true,
    );

    // Update user progress (tracks attempts)
    await this.userProgress.updateProgressOnSubmit(userId, problemId);

    return { submissionId: submission.id.toString(), contestId };
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
    contestId?: number,
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
      contestId: contestId ?? null,
    });

    const saved = await this.submissionRepository.save(submission);
    this.logger.log(`Submission ${saved.id} created for user ${userId}`);
    return saved;
  }

  /**
   * Submit to Judge0 and initialize tracking.
   * With the batched harness approach, exactly ONE Judge0 submission is created
   * regardless of testcase count.
   */
  private async submitToJudge0(
    submissionId: string,
    judge0LanguageId: number,
    languageSlug: string,
    harnessCode: string | null,
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

    const { payloads, testcaseCount } = isSubmit
      ? await this.payloadBuilder.buildPayloadsForSubmit(
          submissionId,
          sourceCode,
          judge0LanguageId,
          problem,
          harnessCode,
          languageSlug,
        )
      : this.payloadBuilder.buildPayloadsForTest(
          submissionId,
          sourceCode,
          judge0LanguageId,
          problem,
          testcases!,
          harnessCode,
          languageSlug,
        );

    if (payloads.length === 0) {
      throw new BadRequestException('No testcases found');
    }

    const judge0BatchResponse: Judge0BatchResponse =
      await this.judge0Service.createSubmissionBatch(payloads);

    if (judge0BatchResponse.length !== payloads.length) {
      throw new InternalServerErrorException(
        `Judge0 token count mismatch: expected ${payloads.length}, got ${judge0BatchResponse.length}`,
      );
    }

    await this.submissionTracker.initializeTracking(
      submissionId,
      testcaseCount,
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
    resultDescription?: ResultDescriptionDto,
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
    submission.resultDescription = resultDescription ?? null;
    submission.totalTestcases = totalTestcases;
    submission.judgedAt = new Date();

    await this.submissionRepository.save(submission);

    // Update user problem progress atomically here (not in the event handler)
    // so isNewlySolved is accurate with no concurrent race condition.
    const { isNewlySolved } = await this.userProgress.updateProgressAfterJudge(
      submission.user.id,
      submission.problem.id,
      submissionId,
      status,
      runtimeMs,
      memoryKb,
    );

    // Emit JUDGED for problem statistics, total attempts, contest leaderboard
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

    if (status === SubmissionStatus.ACCEPTED) {
      this.eventEmitter.emit(
        SUBMISSION_EVENTS.ACCEPTED,
        new SubmissionAcceptedEvent(
          submissionId,
          submission.user.id,
          submission.problem.id,
          runtimeMs,
          memoryKb,
        ),
      );
    }

    // Only emit PROBLEM_SOLVED on the very first AC for this (user, problem)
    if (isNewlySolved) {
      await this.notificationsService.create({
        recipientId: submission.user.id,
        type: NotificationType.SUBMISSION,
        translations: [
          {
            languageCode: Language.EN,
            title: 'Problem Solved!',
            content: `Congratulations! You have successfully solved "${submission.problem.title}".`,
          },
          {
            languageCode: Language.VI,
            title: 'Giải bài thành công!',
            content: `Chúc mừng! Bạn đã giải thành công bài "${submission.problem.title}".`,
          },
        ],
        metadata: {
          event: NotificationEvent.PROBLEM_SOLVED,
          problemId: submission.problem.id,
          problemSlug: submission.problem.slug,
          submissionId,
        },
      });

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
    includeSourceCode = false,
    canViewAll: boolean,
    userId?: number,
  ): Promise<SubmissionResponseDto> {
    return this.retrievalService.getSubmissionById(
      id,
      canViewAll,
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
  async getUserProblemProgress(
    userId: number,
    problemId: number,
  ): Promise<UserProblemProgressDetailResponseDto | null> {
    return this.userProgress.getUserProgress(userId, problemId);
  }

  /**
   * Get all user progress (delegates to progress service)
   */
  async getUserAllProgress(
    userId: number,
    query: GetPracticeHistoryDto,
  ): Promise<PaginatedResultDto<UserPracticeHistoryDto>> {
    return this.userProgress.getAllUserProgress(userId, query);
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

  /**
   * Generate or retrieve AI review for a submission
   */
  async generateAIReview(
    submissionId: number,
    userId: number,
    customPrompt?: string,
  ): Promise<{ review: string; cached: boolean }> {
    // Fetch submission with problem details
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['problem', 'language'],
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${submissionId} not found`);
    }

    // Verify ownership (users can only review their own submissions)
    if (submission.userId !== userId) {
      throw new BadRequestException('You can only review your own submissions');
    }

    // Return cached review if available
    if (submission.aiReview) {
      return { review: submission.aiReview, cached: true };
    }

    // Get problem details
    const problem = submission.problem;
    if (!problem) {
      throw new NotFoundException('Problem not found for this submission');
    }

    // Prepare template variables
    const variables: Record<string, string> = {
      problemContext: `${problem.title}\n\n${problem.description || ''}`,
      language: submission.language?.name || 'Unknown',
      userCode: submission.sourceCode || '',
    };

    // Add custom prompt if provided
    if (customPrompt) {
      variables.custom_instructions = customPrompt;
    }

    try {
      // Compile prompt from Langfuse template
      const compiledPrompt = await this.promptService.getCompiledPrompt(
        PromptFeature.CODE_REVIEWER,
        variables,
      );

      // Generate AI review
      const review = await this.langChainService.generateContent(
        compiledPrompt,
        {
          threadId: `code-review-${submissionId}`,
          runName: 'code-review',
          metadata: {
            submissionId,
            problemId: problem.id,
            userId,
          },
        },
      );

      // Save review to database
      submission.aiReview = review;
      await this.submissionRepository.save(submission);

      return { review, cached: false };
    } catch (error) {
      this.logger.error(
        `Failed to generate AI review for submission ${submissionId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to generate AI review. Please try again later.',
      );
    }
  }
}
