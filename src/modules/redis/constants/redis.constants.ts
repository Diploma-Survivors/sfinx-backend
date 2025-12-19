/**
 * Redis module constants
 */

/**
 * Default TTL values in seconds
 */
export const REDIS_TTL = {
  /** 1 minute */
  ONE_MINUTE: 60,
  /** 5 minutes */
  FIVE_MINUTES: 300,
  /** 15 minutes */
  FIFTEEN_MINUTES: 900,
  /** 1 hour */
  ONE_HOUR: 3600,
  /** 1 day */
  ONE_DAY: 86400,
  /** 1 week */
  ONE_WEEK: 604800,
  /** 1 month (30 days) */
  ONE_MONTH: 2592000,
} as const;

/**
 * Redis key prefixes for different modules
 */
export const REDIS_PREFIX = {
  /** Cache prefix */
  CACHE: 'cache',
  /** Session prefix */
  SESSION: 'session',
  /** Rate limit prefix */
  RATE_LIMIT: 'ratelimit',
  /** Queue prefix */
  QUEUE: 'queue',
  /** Lock prefix */
  LOCK: 'lock',
  /** Pub/Sub prefix */
  PUBSUB: 'pubsub',
} as const;

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  /** Email queue */
  EMAIL: 'email',
  /** Notification queue */
  NOTIFICATION: 'notification',
  /** File processing queue */
  FILE_PROCESSING: 'file-processing',
  /** Code execution queue */
  CODE_EXECUTION: 'code-execution',
} as const;

/**
 * Pub/Sub channel names
 */
export const PUBSUB_CHANNELS = {
  /** User events */
  USER_EVENTS: 'user:events',
  /** Submission events */
  SUBMISSION_EVENTS: 'submission:events',
  /** Problem events */
  PROBLEM_EVENTS: 'problem:events',
  /** System events */
  SYSTEM_EVENTS: 'system:events',
} as const;

/**
 * Redis error codes
 */
export const REDIS_ERROR_CODES = {
  CONNECTION_FAILED: 'REDIS_CONNECTION_FAILED',
  OPERATION_FAILED: 'REDIS_OPERATION_FAILED',
  TIMEOUT: 'REDIS_TIMEOUT',
  SCRIPT_ERROR: 'REDIS_SCRIPT_ERROR',
} as const;
