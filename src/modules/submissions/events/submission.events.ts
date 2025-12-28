import { SubmissionStatus } from '../enums/submission-status.enum';

/**
 * Base event class for submission events
 */
export abstract class SubmissionEvent {
  constructor(
    public readonly submissionId: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a new submission is created
 */
export class SubmissionCreatedEvent extends SubmissionEvent {
  constructor(
    submissionId: number,
    public readonly userId: number,
    public readonly problemId: number,
    public readonly languageId: number,
  ) {
    super(submissionId);
  }
}

/**
 * Event emitted when a submission is judged (result available)
 */
export class SubmissionJudgedEvent extends SubmissionEvent {
  constructor(
    submissionId: number,
    public readonly userId: number,
    public readonly problemId: number,
    public readonly status: SubmissionStatus,
    public readonly passedTestcases: number,
    public readonly totalTestcases: number,
    public readonly runtimeMs?: number,
    public readonly memoryKb?: number,
  ) {
    super(submissionId);
  }
}

/**
 * Event emitted when a submission is accepted (AC)
 */
export class SubmissionAcceptedEvent extends SubmissionEvent {
  constructor(
    submissionId: number,
    public readonly userId: number,
    public readonly problemId: number,
    public readonly runtimeMs?: number,
    public readonly memoryKb?: number,
  ) {
    super(submissionId);
  }
}

/**
 * Event emitted when a user solves a problem for the first time
 */
export class ProblemSolvedEvent extends SubmissionEvent {
  constructor(
    submissionId: number,
    public readonly userId: number,
    public readonly problemId: number,
  ) {
    super(submissionId);
  }
}
