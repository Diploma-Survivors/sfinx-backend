import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview, InterviewStatus } from '../entities/interview.entity';
import { AiInterviewService } from '../services/ai-interview.service';
import { ProgrammingLanguageService } from '../../programming-language/programming-language.service';

@Processor('interview-timeout')
export class InterviewTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(InterviewTimeoutProcessor.name);

  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    private readonly aiInterviewService: AiInterviewService,
    private readonly languagesService: ProgrammingLanguageService,
  ) {
    super();
  }

  async process(job: Job<{ interviewId: string }>): Promise<void> {
    const { interviewId } = job.data;

    this.logger.log(`Processing timeout for interview ${interviewId}`);

    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });

    // Safety check: only end if still active
    if (!interview) {
      this.logger.warn(`Interview ${interviewId} not found, skipping timeout`);
      return;
    }

    if (interview.status !== InterviewStatus.ACTIVE) {
      this.logger.log(
        `Interview ${interviewId} already ended (status: ${interview.status}), skipping timeout`,
      );
      return;
    }

    this.logger.log(`Auto-ending interview ${interviewId} due to time limit`);

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

    // End interview with evaluation
    try {
      await this.aiInterviewService.endInterview(
        interviewId,
        interview.userId,
        sourceCode,
        languageId,
      );
      this.logger.log(`Successfully auto-ended interview ${interviewId}`);
    } catch (error) {
      this.logger.error(`Failed to auto-end interview ${interviewId}`, error);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }
}
