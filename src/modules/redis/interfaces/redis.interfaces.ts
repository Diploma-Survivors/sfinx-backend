import { RedisOptions } from 'ioredis';

/**
 * Redis module configuration options
 */
export interface RedisModuleOptions {
  /** Redis connection options */
  config: RedisOptions;
  /** Whether to enable health checks */
  enableHealthCheck?: boolean;
  /** Custom name for the Redis connection */
  connectionName?: string;
}

/**
 * Cache options for caching operations
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache key prefix */
  prefix?: string;
  /** Tags for cache invalidation */
  tags?: string[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Time when the limit resets (Unix timestamp) */
  resetTime: number;
  /** Retry after seconds (if not allowed) */
  retryAfter?: number;
}

/**
 * Session data structure
 */
export interface SessionData {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Session data */
  data: Record<string, any>;
  /** Created at timestamp */
  createdAt: number;
  /** Last accessed timestamp */
  lastAccessedAt: number;
  /** Expires at timestamp */
  expiresAt: number;
}

/**
 * Queue job options
 */
export interface QueueJobOptions {
  /** Job priority (higher number = higher priority) */
  priority?: number;
  /** Delay in milliseconds before processing */
  delay?: number;
  /** Number of retry attempts */
  attempts?: number;
  /** Backoff strategy for retries */
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  /** Remove job on completion */
  removeOnComplete?: boolean | number;
  /** Remove job on failure */
  removeOnFail?: boolean | number;
}

/**
 * Queue metrics
 */
export interface QueueMetrics {
  /** Number of waiting jobs */
  waiting: number;
  /** Number of active jobs */
  active: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of delayed jobs */
  delayed: number;
  /** Number of paused jobs */
  paused: number;
}

/**
 * Pub/Sub message handler
 */
export type MessageHandler = (
  channel: string,
  message: string,
) => void | Promise<void>;

/**
 * Pub/Sub pattern message handler
 */
export type PatternMessageHandler = (
  pattern: string,
  channel: string,
  message: string,
) => void | Promise<void>;

/**
 * Lock options
 */
export interface LockOptions {
  /** Lock TTL in milliseconds */
  ttl?: number;
  /** Number of retry attempts */
  retryCount?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Lock result
 */
export interface LockResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  /** Lock identifier (for unlocking) */
  identifier?: string;
}

/**
 * Lua script definition
 */
export interface LuaScript {
  /** Script name/identifier */
  name: string;
  /** Lua script content */
  script: string;
  /** Number of keys the script expects */
  numberOfKeys: number;
}

/**
 * Scan result
 */
export interface ScanResult {
  /** Next cursor position */
  cursor: string;
  /** Keys found in this scan */
  keys: string[];
}
