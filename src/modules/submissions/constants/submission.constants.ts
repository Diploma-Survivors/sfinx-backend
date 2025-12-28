/**
 * Submission queue and job constants
 */

/**
 * Queue names for submission processing
 * Note: BullMQ does not allow colons in queue names
 */
export const SUBMISSION_QUEUES = {
  FINALIZE: 'submission-finalize',
} as const;

/**
 * Job names for submission processing
 */
export const SUBMISSION_JOBS = {
  FINALIZE_SUBMIT: 'finalize-submit',
  FINALIZE_RUN: 'finalize-run',
} as const;

/**
 * Pub/Sub channels for submission events
 */
export const SUBMISSION_CHANNELS = {
  RESULT_READY: 'submission:result:ready',
} as const;

/**
 * Submission processing constants
 */
export const SUBMISSION_PROCESSING = {
  /** Lock TTL in seconds for finalization */
  LOCK_TTL: 600,
  /** Maximum time to wait for all results in seconds */
  MAX_WAIT_TIME: 300,
} as const;

/**
 * SSE (Server-Sent Events) constants
 */
export const SUBMISSION_SSE = {
  /** Replay buffer size for SSE streams */
  REPLAY_BUFFER_SIZE: 1,
  /** Ping data sent to keep connection alive */
  PING_DATA: '\n\n',
} as const;

/**
 * Cache constants for submissions module
 */
export const SUBMISSION_CACHE = {
  /** Cache TTL for user statistics (5 minutes) */
  USER_STATS_TTL: 300,
  /** Cache key prefix for user statistics */
  USER_STATS_PREFIX: 'user-stats',
} as const;

/**
 * Re-export submission event constants
 */
export { SUBMISSION_EVENTS } from './submission-events.constants';
