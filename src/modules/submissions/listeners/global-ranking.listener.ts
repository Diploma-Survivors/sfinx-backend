import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SUBMISSION_EVENTS } from '../constants/submission.constants';
import { UserStatisticsService } from '../services';

@Injectable()
export class GlobalRankingListener {
  private readonly logger = new Logger(GlobalRankingListener.name);

  constructor(private readonly userStatisticsService: UserStatisticsService) {}

  @OnEvent(SUBMISSION_EVENTS.PROBLEM_SOLVED)
  async handleProblemSolved(payload: { userId: number; problemId: number }) {
    this.logger.log(
      `Handling global ranking update for user ${payload.userId}`,
    );
    try {
      await this.userStatisticsService.incrementGlobalScore(
        payload.userId,
        payload.problemId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update global score for user ${payload.userId}`,
        error,
      );
    }
  }
}
