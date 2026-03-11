import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SUBMISSION_EVENTS } from 'src/modules/submissions/constants/submission-events.constants';
import { ProblemSolvedEvent } from 'src/modules/submissions/events/submission.events';
import { StudyPlanEnrollmentService } from '../services/study-plan-enrollment.service';

@Injectable()
export class StudyPlanProgressListener {
  private readonly logger = new Logger(StudyPlanProgressListener.name);

  constructor(private readonly enrollmentService: StudyPlanEnrollmentService) {}

  @OnEvent(SUBMISSION_EVENTS.PROBLEM_SOLVED)
  async handleProblemSolved(event: ProblemSolvedEvent): Promise<void> {
    try {
      await this.enrollmentService.syncProgressForProblem(
        event.userId,
        event.problemId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync study plan progress for user ${event.userId}, problem ${event.problemId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
