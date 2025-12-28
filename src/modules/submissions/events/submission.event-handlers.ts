import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { ProblemsService } from '../../problems/problems.service';
import { SubmissionStatus } from '../enums/submission-status.enum';
import { SUBMISSION_EVENTS } from '../constants/submission-events.constants';
import {
  SubmissionCreatedEvent,
  SubmissionJudgedEvent,
  SubmissionAcceptedEvent,
  ProblemSolvedEvent,
} from './submission.events';

/**
 * Event handlers for submission lifecycle events
 * Decouples side effects from main business logic
 * Follows Open/Closed Principle - easy to add new handlers
 */
@Injectable()
export class SubmissionEventHandlers {
  private readonly logger = new Logger(SubmissionEventHandlers.name);

  constructor(
    private readonly problemsService: ProblemsService,
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Handle submission created event
   */
  @OnEvent(SUBMISSION_EVENTS.CREATED)
  handleSubmissionCreated(event: SubmissionCreatedEvent): void {
    this.logger.debug(
      `Submission ${event.submissionId} created by user ${event.userId} for problem ${event.problemId}`,
    );
    // Future: Send notification, track analytics, etc.
  }

  /**
   * Handle submission judged event
   * Updates problem statistics
   */
  @OnEvent(SUBMISSION_EVENTS.JUDGED)
  async handleSubmissionJudged(event: SubmissionJudgedEvent): Promise<void> {
    this.logger.debug(
      `Submission ${event.submissionId} judged: ${event.status} (${event.passedTestcases}/${event.totalTestcases})`,
    );

    try {
      // Update problem statistics
      await this.updateProblemStatistics(event.problemId, event.status);

      // TODO: Implement user notification preferences
      // Uncomment to send email for all judged submissions (requires user opt-in setting)
      // await this.sendSubmissionResultEmail(event);
    } catch (error) {
      this.logger.error(
        `Failed to update problem statistics for submission ${event.submissionId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Handle submission accepted event
   */
  @OnEvent(SUBMISSION_EVENTS.ACCEPTED)
  handleSubmissionAccepted(event: SubmissionAcceptedEvent): void {
    this.logger.log(
      `Submission ${event.submissionId} accepted! User ${event.userId} solved problem ${event.problemId}`,
    );
    // Future: Send notification, update achievements, etc.
  }

  /**
   * Handle problem solved (first AC) event
   */
  @OnEvent(SUBMISSION_EVENTS.PROBLEM_SOLVED)
  async handleProblemSolved(event: ProblemSolvedEvent): Promise<void> {
    this.logger.log(
      `🎉 User ${event.userId} solved problem ${event.problemId} for the first time!`,
    );

    try {
      // Fetch user and problem details
      const [user, problem] = await Promise.all([
        this.userRepository.findOne({ where: { id: event.userId } }),
        this.problemsService.findProblemEntityById(event.problemId),
      ]);

      if (!user || !problem) {
        this.logger.warn(
          `Cannot send email: User ${event.userId} or Problem ${event.problemId} not found`,
        );
        return;
      }

      // Send congratulations email
      await this.mailService.sendSubmissionResultEmail(user.email, {
        userName: user.fullName || user.username,
        problemTitle: problem.title,
        status: 'Accepted',
        score: 100,
        submittedAt: event.timestamp,
      });

      this.logger.log(
        `Congratulations email sent to ${user.email} for solving problem ${problem.title}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send congratulations email for submission ${event.submissionId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Update problem statistics
   */
  private async updateProblemStatistics(
    problemId: number,
    status: SubmissionStatus,
  ): Promise<void> {
    const problem = await this.problemsService.findProblemEntityById(problemId);

    problem.totalSubmissions += 1;

    if (status === SubmissionStatus.ACCEPTED) {
      problem.totalAccepted += 1;
    }

    // Calculate acceptance rate
    if (problem.totalSubmissions > 0) {
      problem.acceptanceRate = Number(
        ((problem.totalAccepted / problem.totalSubmissions) * 100).toFixed(2),
      );
    }

    await this.problemsService.updateProblemStats(problemId);
  }

  /**
   * Send submission result email
   * Helper method for sending email notifications
   */
  private async sendSubmissionResultEmail(
    event: SubmissionJudgedEvent,
  ): Promise<void> {
    try {
      const [user, problem] = await Promise.all([
        this.userRepository.findOne({ where: { id: event.userId } }),
        this.problemsService.findProblemEntityById(event.problemId),
      ]);

      if (!user || !problem) {
        this.logger.warn(
          `Cannot send email: User ${event.userId} or Problem ${event.problemId} not found`,
        );
        return;
      }

      const score =
        event.totalTestcases > 0
          ? Math.round((event.passedTestcases / event.totalTestcases) * 100)
          : 0;

      await this.mailService.sendSubmissionResultEmail(user.email, {
        userName: user.fullName || user.username,
        problemTitle: problem.title,
        status: this.getStatusDisplayName(event.status),
        score,
        submittedAt: event.timestamp,
      });

      this.logger.debug(
        `Submission result email sent to ${user.email} for submission ${event.submissionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send submission result email for submission ${event.submissionId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Get human-readable status name
   */
  private getStatusDisplayName(status: SubmissionStatus): string {
    const statusMap: Record<SubmissionStatus, string> = {
      [SubmissionStatus.ACCEPTED]: 'Accepted',
      [SubmissionStatus.WRONG_ANSWER]: 'Wrong Answer',
      [SubmissionStatus.TIME_LIMIT_EXCEEDED]: 'Time Limit Exceeded',
      [SubmissionStatus.MEMORY_LIMIT_EXCEEDED]: 'Memory Limit Exceeded',
      [SubmissionStatus.RUNTIME_ERROR]: 'Runtime Error',
      [SubmissionStatus.COMPILATION_ERROR]: 'Compilation Error',
      [SubmissionStatus.PENDING]: 'Pending',
      [SubmissionStatus.RUNNING]: 'Running',
      [SubmissionStatus.UNKNOWN_ERROR]: 'Unknown Error',
    };

    return statusMap[status] || status;
  }
}
