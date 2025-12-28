/**
 * Submission event name constants
 * Used with NestJS EventEmitter
 */
export const SUBMISSION_EVENTS = {
  /** Emitted when a new submission is created */
  CREATED: 'submission.created',
  /** Emitted when a submission has been judged */
  JUDGED: 'submission.judged',
  /** Emitted when a submission is accepted (AC) */
  ACCEPTED: 'submission.accepted',
  /** Emitted when a user solves a problem for the first time */
  PROBLEM_SOLVED: 'submission.problem.solved',
} as const;

/** Type for submission event names */
export type SubmissionEventName =
  (typeof SUBMISSION_EVENTS)[keyof typeof SUBMISSION_EVENTS];
