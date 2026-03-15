import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InterviewMode } from '../enums';

@Injectable()
export class InterviewTimeoutService {
  private readonly logger = new Logger(InterviewTimeoutService.name);

  constructor(
    @InjectQueue('interview-timeout')
    private readonly timeoutQueue: Queue,
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

  private getModeDurationMs(mode: InterviewMode): number {
    const durations: Record<InterviewMode, number> = {
      [InterviewMode.SHORT]: 30 * 60 * 1000, // 30 minutes
      [InterviewMode.STANDARD]: 45 * 60 * 1000, // 45 minutes
      [InterviewMode.LONG]: 60 * 60 * 1000, // 60 minutes
    };
    return durations[mode];
  }
}
