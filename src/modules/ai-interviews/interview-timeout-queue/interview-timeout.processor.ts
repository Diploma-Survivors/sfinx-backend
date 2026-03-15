import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InterviewTimeoutService } from './interview-timeout.service';

@Processor('interview-timeout')
export class InterviewTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(InterviewTimeoutProcessor.name);

  constructor(private readonly timeoutService: InterviewTimeoutService) {
    super();
  }

  async process(job: Job<{ interviewId: string }>): Promise<void> {
    const { interviewId } = job.data;

    this.logger.log(`Processing timeout for interview ${interviewId}`);

    try {
      await this.timeoutService.autoEndInterview(interviewId);
      this.logger.log(
        `Successfully processed timeout for interview ${interviewId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process timeout for interview ${interviewId}`,
        error,
      );
      throw error; // Re-throw to trigger BullMQ retry
    }
  }
}
