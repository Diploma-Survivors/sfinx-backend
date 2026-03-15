import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview, InterviewStatus } from '../entities/interview.entity';
import { InterviewEvaluation } from '../entities/interview-evaluation.entity';
import { InterviewMessage } from '../entities/interview-message.entity';
import { InterviewMode } from '../enums';
import { ProgrammingLanguageService } from '../../programming-language/programming-language.service';
import { Judge0Service } from '../../judge0/judge0.service';
import { ProblemsService } from '../../problems/problems.service';
import { Judge0PayloadBuilderService } from '../../submissions/services/judge0-payload-builder.service';
import { SubmissionTrackerService } from '../../submissions/services/submission-tracker.service';
import { LangChainService } from '../../ai/langchain.service';
import { PromptService, PromptFeature } from '../../ai/prompt.service';
import { Judge0Response } from '../../judge0/interfaces';

interface Judge0EvaluationContext {
  passedTestcases: number;
  totalTestcases: number;
  status: 'ACCEPTED' | 'REJECTED' | 'PARTIAL';
  runtimeMs?: number;
  memoryKb?: number;
  failedTestCases?: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    error?: string;
  }>;
}

interface EvaluationResponse {
  problem_solving_score?: number;
  code_quality_score?: number;
  communication_score?: number;
  technical_score?: number;
  overall_score?: number;
  strengths?: string[];
  improvements?: string[];
  detailed_feedback?: string;
}

@Injectable()
export class InterviewTimeoutService {
  private readonly logger = new Logger(InterviewTimeoutService.name);

  constructor(
    @InjectQueue('interview-timeout')
    private readonly timeoutQueue: Queue,
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewEvaluation)
    private readonly evaluationRepo: Repository<InterviewEvaluation>,
    @InjectRepository(InterviewMessage)
    private readonly messageRepo: Repository<InterviewMessage>,
    private readonly languagesService: ProgrammingLanguageService,
    private readonly judge0Service: Judge0Service,
    private readonly problemsService: ProblemsService,
    private readonly payloadBuilder: Judge0PayloadBuilderService,
    private readonly submissionTracker: SubmissionTrackerService,
    private readonly langChainService: LangChainService,
    private readonly promptService: PromptService,
  ) {}

  async scheduleTimeout(
    interviewId: string,
    mode: InterviewMode,
  ): Promise<Date> {
    const durationMs = this.getModeDurationMs(mode);
    const scheduledEndAt = new Date(Date.now() + durationMs);

    await this.timeoutQueue.add(
      'end-interview',
      { interviewId },
      {
        jobId: `end-interview-${interviewId}`,
        delay: durationMs,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Interview ${interviewId} timeout scheduled for ${scheduledEndAt.toISOString()}`,
    );

    return scheduledEndAt;
  }

  async cancelTimeout(interviewId: string): Promise<boolean> {
    const jobId = `end-interview-${interviewId}`;
    const job = await this.timeoutQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Interview ${interviewId} timeout cancelled`);
      return true;
    }

    return false;
  }

  async autoEndInterview(
    interviewId: string,
  ): Promise<InterviewEvaluation | null> {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
      relations: ['messages'],
    });

    if (!interview || interview.status !== InterviewStatus.ACTIVE) {
      this.logger.log(
        `Interview ${interviewId} not active or not found, skipping auto-end`,
      );
      return null;
    }

    // Get current code snapshot if available
    let sourceCode: string | undefined;
    let languageId: number | undefined;

    if (interview.problemSnapshot?.latestCode) {
      sourceCode = interview.problemSnapshot.latestCode;

      if (interview.problemSnapshot.codeLanguage) {
        try {
          const language = await this.languagesService.findBySlug(
            interview.problemSnapshot.codeLanguage,
          );
          languageId = language.id;
        } catch {
          this.logger.warn(
            `Could not find language for ${interview.problemSnapshot.codeLanguage}`,
          );
        }
      }
    }

    // Update interview status
    interview.status = InterviewStatus.COMPLETED;
    interview.endedAt = new Date();
    await this.interviewRepo.save(interview);

    // Execute code against test cases if provided
    let judge0Context: Judge0EvaluationContext | undefined;

    if (sourceCode && languageId) {
      try {
        const language = await this.languagesService.findById(languageId);
        judge0Context = await this.executeCodeSync(
          interview.problemId,
          sourceCode,
          language.judge0Id,
        );
      } catch (error) {
        this.logger.error('Judge0 execution error:', error);
      }
    }

    // Prepare context for AI evaluation
    const transcript = interview.messages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n');
    const problemContext = JSON.stringify(interview.problemSnapshot);

    // Evaluate with AI
    const prompt = await this.promptService.getCompiledPrompt(
      PromptFeature.EVALUATOR,
      {
        problemContext,
        transcript,
        judgeZeroResults: judge0Context
          ? JSON.stringify(judge0Context)
          : 'No code submitted',
      },
    );

    const defaultEvaluation: EvaluationResponse = {
      overall_score: 0,
      detailed_feedback: 'Evaluation failed to generate.',
    };
    let evaluationData: EvaluationResponse = defaultEvaluation;

    try {
      let aiResponse = await this.langChainService.generateContent(prompt, {
        threadId: `interview-${interview.id}`,
        runName: 'interview-evaluation',
        metadata: {
          userId: interview.userId,
          problemId: interview.problemId,
          judge0Status: judge0Context?.status,
        },
      });
      aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '');
      evaluationData = JSON.parse(aiResponse) as EvaluationResponse;
    } catch (error) {
      this.logger.error('Evaluation Error:', error);
    }

    // Save evaluation
    const evaluation = this.evaluationRepo.create({
      interviewId: interview.id,
      problemSolvingScore: evaluationData.problem_solving_score ?? 0,
      codeQualityScore: evaluationData.code_quality_score ?? 0,
      communicationScore: evaluationData.communication_score ?? 0,
      technicalScore: evaluationData.technical_score ?? 0,
      overallScore: evaluationData.overall_score ?? 0,
      strengths: evaluationData.strengths ?? [],
      improvements: evaluationData.improvements ?? [],
      detailedFeedback: evaluationData.detailed_feedback ?? '',
    });

    await this.evaluationRepo.save(evaluation);
    this.logger.log(`Successfully auto-ended interview ${interviewId}`);

    return evaluation;
  }

  private async executeCodeSync(
    problemId: number,
    sourceCode: string,
    judge0LanguageId: number,
  ): Promise<Judge0EvaluationContext> {
    const problem = await this.problemsService.findProblemEntityById(problemId);

    if (!problem.testcaseFileKey) {
      return {
        passedTestcases: 0,
        totalTestcases: 0,
        status: 'REJECTED',
      };
    }

    const submissionId = 'interview-' + Date.now();

    const payloads = await this.payloadBuilder.buildPayloadsForSubmit(
      submissionId,
      sourceCode,
      judge0LanguageId,
      problem,
    );

    if (payloads.length === 0) {
      return {
        passedTestcases: 0,
        totalTestcases: 0,
        status: 'REJECTED',
      };
    }

    await this.submissionTracker.initializeTracking(
      submissionId,
      payloads.length,
      problem.id,
    );

    const batchResponse =
      await this.judge0Service.createSubmissionBatch(payloads);

    const maxWaitTime = 30000;
    const pollInterval = 500;
    const startTime = Date.now();

    const tokens = batchResponse.map((r) => r.token);
    const results: Judge0Response[] = [];
    let pendingTokens = [...tokens];

    while (pendingTokens.length > 0 && Date.now() - startTime < maxWaitTime) {
      const batchResults =
        await this.judge0Service.getSubmissionsBatch(pendingTokens);

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        if (result.status.id !== 1 && result.status.id !== 2) {
          results.push(result);
          pendingTokens = pendingTokens.filter((t) => t !== result.token);
        }
      }

      if (pendingTokens.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    let passedCount = 0;
    const failedTestCases: Judge0EvaluationContext['failedTestCases'] = [];
    let totalRuntime = 0;
    let totalMemory = 0;

    for (const result of results) {
      const isAccepted = result.status.id === 3;

      if (isAccepted) {
        passedCount++;
      } else {
        failedTestCases.push({
          input: result.stdin || '',
          expectedOutput: result.expected_output || '',
          actualOutput:
            result.stdout || result.stderr || result.compile_output || '',
          error: result.status.description,
        });
      }

      if (result.time) totalRuntime += result.time * 1000;
      if (result.memory) totalMemory += result.memory;
    }

    const totalTestcases = payloads.length;

    return {
      passedTestcases: passedCount,
      totalTestcases,
      status:
        passedCount === totalTestcases
          ? 'ACCEPTED'
          : passedCount > 0
            ? 'PARTIAL'
            : 'REJECTED',
      runtimeMs: Math.round(totalRuntime / results.length) || undefined,
      memoryKb: Math.round(totalMemory / results.length) || undefined,
      failedTestCases: failedTestCases.slice(0, 3),
    };
  }

  private getModeDurationMs(mode: InterviewMode): number {
    const durations: Record<InterviewMode, number> = {
      [InterviewMode.SHORT]: 30 * 60 * 1000, // 30 minutes
      [InterviewMode.STANDARD]: 45 * 60 * 1000, // 45 minutes
      [InterviewMode.LONG]: 60 * 60 * 1000, // 60 minutes
    };
    return durations[mode];
  }
}
