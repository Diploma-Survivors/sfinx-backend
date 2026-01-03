import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ContestService } from '../services';
import {
  BULL_EVENTS,
  CONTEST_JOBS,
  CONTEST_QUEUE,
} from '../constants/scheduler.constants';

@Processor(CONTEST_QUEUE)
export class ContestSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(ContestSchedulerProcessor.name);

  constructor(private readonly contestService: ContestService) {
    super();
  }

  async process(job: Job<{ contestId: number }, any, string>): Promise<any> {
    const { contestId } = job.data;
    this.logger.log(`Processing job ${job.name} for contest ${contestId}`);

    try {
      switch (job.name) {
        case CONTEST_JOBS.START:
          await this.contestService.startContest(contestId);
          this.logger.log(`Started contest ${contestId}`);
          break;
        case CONTEST_JOBS.END:
          await this.contestService.endContest(contestId);
          this.logger.log(`Ended contest ${contestId}`);
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
      }
    } catch (error: any) {
      // If error is "Can only start scheduled contests" (already started), ignore it
      if (error.message && error.message.includes('Can only start')) {
        this.logger.warn(
          `Skipped start for contest ${contestId}: ${error.message}`,
        );
        return;
      }
      if (error.message && error.message.includes('Can only end')) {
        this.logger.warn(
          `Skipped end for contest ${contestId}: ${error.message}`,
        );
        return;
      }
      this.logger.error(
        `Failed to process job ${job.name} for contest ${contestId}`,
        error,
      );
      throw error; // Retry job
    }
  }

  @OnWorkerEvent(BULL_EVENTS.COMPLETED)
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} of type ${job.name} completed`);
  }

  @OnWorkerEvent(BULL_EVENTS.FAILED)
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed: ${err.message}`,
    );
  }
}
