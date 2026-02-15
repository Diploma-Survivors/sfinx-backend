import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { ContestSubmissionService } from '../../contest/services';
import { MailService } from '../../mail';
import { Problem } from '../../problems/entities/problem.entity';
import { ProblemsService } from '../../problems/problems.service';
import { SUBMISSION_EVENTS } from '../constants/submission-events.constants';
import { SubmissionStatus } from '../enums';
import { UserProgressService, UserStatisticsService } from '../services';
import {
  ProblemSolvedEvent,
  SubmissionAcceptedEvent,
  SubmissionCreatedEvent,
  SubmissionJudgedEvent,
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
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    private readonly contestSubmissionService: ContestSubmissionService,
    private readonly userProgressService: UserProgressService,
    private readonly userStatisticsService: UserStatisticsService,
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
      // 1. Update Problem Statistics (Acceptance Rate, Total Submissions)
      await this.updateProblemStatistics(
        event.problemId,
        event.status,
        event.userId,
      );

      // 2. Update User Statistics (Total Attempts)
      // User problem progress is updated in updateSubmissionAfterJudge before
      // events fire, so it is NOT repeated here.
      await this.userStatisticsService.incrementTotalAttempts(event.userId);

      // 3. Update Contest Leaderboard (Attempts & Score)
      await this.contestSubmissionService.handleContestSubmissionResult(event);

      // 4. Notifications (Optional)
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
  handleSubmissionAccepted(event: SubmissionAcceptedEvent) {
    this.logger.log(
      `Submission ${event.submissionId} accepted! User ${event.userId} solved problem ${event.problemId}`,
    );

    try {
      // Increment score and solved counts (handled by service to check if already solved)
      // Check if ProblemSolved event handles this - usually ProblemSolved is for FIRST solve.
    } catch (error) {
      this.logger.error(
        `Failed to handle accepted submission ${event.submissionId}`,
        error,
      );
    }
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
      // 1. Update User Statistics (Global Score, Solved Counts)
      await this.userStatisticsService.updateUserStatistic(
        event.userId,
        event.problemId,
      );

      // 2. Fetch user and problem details for email
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

      // 3. Send congratulations email
      // await this.mailService.sendSubmissionResultEmail(user.email, {
      //   userName: user.fullName || user.username,
      //   problemTitle: problem.title,
      //   status: 'Accepted',
      //   score: 100,
      //   submittedAt: event.timestamp,
      // });

      // 4. Update Problem Statistics (Total Solved)
      problem.totalSolved += 1;
      await this.problemRepository.save(problem);

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
    userId: number,
  ): Promise<void> {
    const problem = await this.problemsService.findProblemEntityById(problemId);

    // Get user progress to check if this is first attempt/solve
    const progress = await this.userProgressService.getUserProgress(
      userId,
      problemId,
    );

    problem.totalSubmissions += 1;

    // Increment totalAttempts only if this is the first attempt (progress.totalAttempts === 1)
    // Note: updateProgressOnSubmit is called before this event, so attempts is at least 1
    if (progress && progress.totalAttempts === 1) {
      problem.totalAttempts += 1;
    }

    if (status === SubmissionStatus.ACCEPTED) {
      problem.totalAccepted += 1;

      // Increment totalSolved only if this is the first solve
      // MOVED to handleProblemSolved event
    }

    // Calculate acceptance rate
    if (problem.totalSubmissions > 0) {
      problem.acceptanceRate = Number(
        ((problem.totalAccepted / problem.totalSubmissions) * 100).toFixed(2),
      );
    }
    await this.problemRepository.save(problem);
  }
}
