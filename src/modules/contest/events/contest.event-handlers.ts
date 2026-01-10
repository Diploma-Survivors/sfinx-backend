import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contest } from '../entities';
import { ContestStatus } from '../enums';
import { ContestService } from '../services';
import {
  ContestCreatedEvent,
  ContestDeletedEvent,
  ContestUpdatedEvent,
} from './contest-scheduled.events';
import {
  CONTEST_JOBS,
  CONTEST_QUEUE,
  getContestEndJobId,
  getContestStartJobId,
} from '../constants/scheduler.constants';

/**
 * Event handlers for contest lifecycle events
 * Handles scheduling of contest start/end jobs via BullMQ
 */
@Injectable()
export class ContestEventHandlers implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContestEventHandlers.name);

  constructor(
    private readonly contestService: ContestService,
    @InjectQueue(CONTEST_QUEUE) private readonly contestQueue: Queue,
    @InjectRepository(Contest)
    private readonly contestRepository: Repository<Contest>,
  ) {}

  /**
   * Initialize scheduler on app bootstrap (Handling restarts)
   */
  async onApplicationBootstrap() {
    this.logger.log('Initializing contest scheduler (BullMQ)...');
    const contests = await this.contestRepository.find({
      where: [
        { status: ContestStatus.SCHEDULED },
        { status: ContestStatus.RUNNING },
      ],
    });

    for (const contest of contests) {
      await this.handleContestSchedule(contest.id);
    }
    this.logger.log(`Scheduled events for ${contests.length} contests`);
  }

  @OnEvent(ContestCreatedEvent.name)
  async handleContestCreated(event: ContestCreatedEvent) {
    await this.handleContestSchedule(event.contestId);
  }

  @OnEvent(ContestUpdatedEvent.name)
  async handleContestUpdated(event: ContestUpdatedEvent) {
    await this.handleContestSchedule(event.contestId);
  }

  @OnEvent(ContestDeletedEvent.name)
  async handleContestDeleted(event: ContestDeletedEvent) {
    await this.removeContestJobs(event.contestId);
  }

  /**
   * Main scheduling logic using BullMQ
   */
  private async handleContestSchedule(contestId: number) {
    const contest = await this.contestService.getContestById(contestId);
    const now = Date.now();

    // 1. Handle Start Logic
    if (contest.status === ContestStatus.SCHEDULED) {
      const delay = Math.max(0, contest.startTime.getTime() - now);
      await this.scheduleJob(
        CONTEST_JOBS.START,
        contestId,
        delay,
        getContestStartJobId(contestId),
      );
    }

    // 2. Handle End Logic
    if (
      contest.status === ContestStatus.SCHEDULED ||
      contest.status === ContestStatus.RUNNING
    ) {
      const delay = Math.max(0, contest.endTime.getTime() - now);
      await this.scheduleJob(
        CONTEST_JOBS.END,
        contestId,
        delay,
        getContestEndJobId(contestId),
      );
    }

    // Cleanup if status changed to ENDED or CANCELLED
    if (
      contest.status === ContestStatus.ENDED ||
      contest.status === ContestStatus.CANCELLED
    ) {
      await this.removeContestJobs(contestId);
    }
  }

  private async scheduleJob(
    name: string,
    contestId: number,
    delay: number,
    jobId: string,
  ) {
    // Remove existing job to reschedule (e.g. time update)
    await this.removeJob(jobId);

    try {
      await this.contestQueue.add(
        name,
        { contestId },
        {
          jobId, // Enforce unique ID
          delay,
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for inspection
        },
      );
      const executeTime = new Date(Date.now() + delay).toISOString();
      this.logger.log(
        `Scheduled BullMQ job ${jobId} to run at ${executeTime} (delay: ${delay}ms)`,
      );
    } catch (e) {
      this.logger.error(`Failed to schedule BullMQ job ${jobId}`, e);
    }
  }

  private async removeContestJobs(contestId: number) {
    await this.removeJob(getContestStartJobId(contestId));
    await this.removeJob(getContestEndJobId(contestId));
  }

  private async removeJob(jobId: string) {
    try {
      const job = await this.contestQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch {
      // Ignore errors
    }
  }
}
