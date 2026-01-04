import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SUBMISSION_EVENTS } from '../../submissions/constants/submission-events.constants';
import { SubmissionAcceptedEvent } from '../../submissions/events/submission.events';
import { ContestSubmissionService } from '../services';

@Injectable()
export class ContestSubmissionListener {
  private readonly logger = new Logger(ContestSubmissionListener.name);

  constructor(
    private readonly contestSubmissionService: ContestSubmissionService,
  ) {}

  @OnEvent(SUBMISSION_EVENTS.ACCEPTED)
  async handleContestSubmissionAccepted(event: SubmissionAcceptedEvent) {
    this.logger.debug(
      `Handling submission ${event.submissionId} judged event (Contest listener)`,
    );

    await this.contestSubmissionService.handleSubmissionResult(event);
  }
}
