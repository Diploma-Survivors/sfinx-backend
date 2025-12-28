/**
 * Submission SSE event types
 */
export enum SubmissionEvent {
  /** Ping event to keep connection alive */
  PING = 'ping',
  /** Result event containing submission result data */
  RESULT = 'result',
}
