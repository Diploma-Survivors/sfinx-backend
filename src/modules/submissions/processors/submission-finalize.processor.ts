import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { CallbackProcessorService } from '../services/callback-processor.service';
import { SUBMISSION_QUEUES } from '../constants/submission.constants';

/**
 * Job data for finalization
 */
interface FinalizeJobData {
  submissionId: string;
  isSubmit: boolean;
}

/**
 * Processor for submission finalization jobs
 * Handles async finalization after all testcase results are received
 */
@Processor(SUBMISSION_QUEUES.FINALIZE)
export class SubmissionFinalizeProcessor extends WorkerHost {
  private readonly logger = new Logger(SubmissionFinalizeProcessor.name);

  constructor(private readonly callbackProcessor: CallbackProcessorService) {
    super();
  }

  async process(job: Job<FinalizeJobData>): Promise<void> {
    const { submissionId, isSubmit } = job.data;

    this.logger.log(
      `Processing finalize job ${job.id} for submission ${submissionId}`,
    );

    try {
      await this.callbackProcessor.finalizer(submissionId, isSubmit);
      this.logger.log(
        `Finalize job ${job.id} completed for submission ${submissionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Finalize job ${job.id} failed for submission ${submissionId}:`,
        error,
      );
      throw error; // Will trigger retry based on queue configuration
    }
  }
}
