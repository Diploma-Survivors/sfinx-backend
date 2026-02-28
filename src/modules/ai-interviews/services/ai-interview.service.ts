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

  async endInterview(id: string, userId: number) {
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

    // 2. Prepare Context
    const transcript = interview.messages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n');
    const problemContext = JSON.stringify(interview.problemSnapshot);

    // 3. Evaluate
    const prompt = await this.promptService.getCompiledPrompt(
      PromptFeature.EVALUATOR,
      { problemContext, transcript },
    );

    const defaultEvaluation: EvaluationResponse = {
      overall_score: 0,
      detailed_feedback: 'Evaluation failed to generate.',
    };
    let evaluationData: EvaluationResponse = defaultEvaluation;

    try {
      let aiResponse = await this.langChainService.generateContent(prompt, {
        threadId: interview.id,
        runName: 'interview-evaluation',
        metadata: { userId: interview.userId, problemId: interview.problemId },
      });
      // Clean up markdown
      aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '');
      evaluationData = JSON.parse(aiResponse) as EvaluationResponse;
    } catch (error) {
      console.error('Evaluation Error:', error);
    }

    // 4. Save Evaluation
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
