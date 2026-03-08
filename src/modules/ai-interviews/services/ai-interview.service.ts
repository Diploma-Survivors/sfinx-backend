import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview, InterviewStatus } from '../entities/interview.entity';
import { InterviewMessage } from '../entities/interview-message.entity';
import { InterviewEvaluation } from '../entities/interview-evaluation.entity';
import { LangChainService } from '../../ai/langchain.service';
import { PromptService, PromptFeature } from '../../ai/prompt.service';
import { StartInterviewDto } from '../dto/start-interview.dto';
import { CodeSnapshotDto } from '../dto/code-snapshot.dto';
import { User } from '../../auth/entities/user.entity';

import { Problem } from '../../problems/entities/problem.entity';
import { Judge0Service } from '../../judge0/judge0.service';
import { ProgrammingLanguageService } from '../../programming-language/programming-language.service';
import { ProblemsService } from '../../problems/problems.service';
import { Judge0PayloadBuilderService } from '../../submissions/services/judge0-payload-builder.service';
import { SubmissionTrackerService } from '../../submissions/services/submission-tracker.service';
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
export class AiInterviewService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(InterviewMessage)
    private readonly messageRepo: Repository<InterviewMessage>,
    @InjectRepository(InterviewEvaluation)
    private readonly evaluationRepo: Repository<InterviewEvaluation>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    private readonly langChainService: LangChainService,
    private readonly promptService: PromptService,
    private readonly judge0Service: Judge0Service,
    private readonly languagesService: ProgrammingLanguageService,
    private readonly problemsService: ProblemsService,
    private readonly payloadBuilder: Judge0PayloadBuilderService,
    private readonly submissionTracker: SubmissionTrackerService,
  ) {}

  async startInterview(user: User, dto: StartInterviewDto) {
    // 1. Fetch Problem
    const problem = await this.problemRepo.findOne({
      where: { id: dto.problemId },
    });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // 2. Create Snapshot
    const problemSnapshot = {
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      // Add other necessary fields
    };

    // 3. Create Interview
    const interview = this.interviewRepo.create({
      userId: user.id,
      problemId: problem.id,
      problemSnapshot: problemSnapshot,
      status: InterviewStatus.ACTIVE,
    });
    await this.interviewRepo.save(interview);

    // The voice agent (Iris) handles the initial greeting via on_enter.
    // For text-mode fallback, the AI will greet on the user's first message.
    return {
      interviewId: interview.id,
      greeting: '',
    };
  }

  async getInterviewHistory(userId: number): Promise<Interview[]> {
    return this.interviewRepo.find({
      where: { userId },
      relations: ['evaluation'],
      order: {
        startedAt: 'DESC',
      },
    });
  }

  async getInterview(id: string, userId: number) {
    const interview = await this.interviewRepo.findOne({
      where: { id, userId },
      relations: ['messages', 'evaluation'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  /**
   * Execute code against all test cases synchronously
   */
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

    // Generate submission ID
    const submissionId = 'interview-' + Date.now();

    // Build payloads for all test cases
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

    // Initialize tracking in Redis with problemId
    await this.submissionTracker.initializeTracking(
      submissionId,
      payloads.length,
      problem.id,
    );

    // Submit batch to Judge0
    const batchResponse =
      await this.judge0Service.createSubmissionBatch(payloads);

    // Wait for all results with timeout
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 500; // 500ms
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
          // Not In Queue or Processing
          results.push(result);
          pendingTokens = pendingTokens.filter((t) => t !== result.token);
        }
      }

      if (pendingTokens.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    // Process results
    let passedCount = 0;
    const failedTestCases: Judge0EvaluationContext['failedTestCases'] = [];
    let totalRuntime = 0;
    let totalMemory = 0;

    for (const result of results) {
      const isAccepted = result.status.id === 3; // Accepted

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
      failedTestCases: failedTestCases.slice(0, 3), // Limit to first 3 failures
    };
  }

  /**
   * Store code snapshot for AI context
   * This allows the AI agent to see the user's current code
   */
  async storeCodeSnapshot(id: string, userId: number, dto: CodeSnapshotDto) {
    const interview = await this.interviewRepo.findOne({
      where: { id, userId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status !== InterviewStatus.ACTIVE) {
      throw new ForbiddenException('Interview is not active');
    }

    // Store the code snapshot in the interview record
    // We can store the latest code in the problemSnapshot or create a separate field
    const updatedSnapshot = {
      ...interview.problemSnapshot,
      latestCode: dto.code,
      codeLanguage: dto.language,
      codeUpdatedAt: dto.timestamp || Date.now(),
    };

    interview.problemSnapshot = updatedSnapshot;
    await this.interviewRepo.save(interview);

    return { success: true };
  }

  async endInterview(
    id: string,
    userId: number,
    sourceCode?: string,
    languageId?: number,
  ) {
    const interview = await this.interviewRepo.findOne({
      where: { id, userId },
      relations: ['messages', 'evaluation'],
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status === InterviewStatus.COMPLETED) {
      return interview.evaluation;
    }

    // 1. Update Status
    interview.status = InterviewStatus.COMPLETED;
    interview.endedAt = new Date();
    await this.interviewRepo.save(interview);

    // 2. Execute code against test cases if provided
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
        console.error('Judge0 execution error:', error);
        // Continue with AI evaluation even if Judge0 fails
      }
    }

    // 3. Prepare Context
    const transcript = interview.messages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n');
    const problemContext = JSON.stringify(interview.problemSnapshot);

    // 4. Evaluate with AI (including Judge0 results)
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
      // Clean up markdown
      aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '');
      evaluationData = JSON.parse(aiResponse) as EvaluationResponse;
    } catch (error) {
      console.error('Evaluation Error:', error);
    }

    // 5. Save Evaluation
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

    return evaluation;
  }
}
