import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { LockOptions, LockResult } from '../interfaces/redis.interfaces';
import { REDIS_PREFIX } from '../constants/redis.constants';

/**
 * Distributed lock service using Redis
 *
 * Implements distributed locking using Redis SET with NX and PX options
 * to prevent race conditions in distributed systems.
 */
@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);
  private readonly defaultTtl = 10000; // 10 seconds
  private readonly defaultRetryCount = 3;
  private readonly defaultRetryDelay = 100; // 100ms

  constructor(private readonly redisService: RedisService) {}

  /**
   * Build a lock key
   */
  private buildLockKey(resource: string): string {
    return `${REDIS_PREFIX.LOCK}:${resource}`;
  }

  /**
   * Generate a unique lock identifier
   */
  private generateIdentifier(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Acquire a distributed lock
   */
  async acquire(resource: string, options?: LockOptions): Promise<LockResult> {
    const lockKey = this.buildLockKey(resource);
    const identifier = this.generateIdentifier();
    const ttl = options?.ttl || this.defaultTtl;
    const retryCount = options?.retryCount || this.defaultRetryCount;
    const retryDelay = options?.retryDelay || this.defaultRetryDelay;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Try to acquire lock using SET NX PX
        const client = this.redisService.getClient();
        const result = await client.set(lockKey, identifier, 'PX', ttl, 'NX');

        if (result === 'OK') {
          this.logger.debug(`Lock acquired for resource: ${resource}`);
          return { acquired: true, identifier };
        }

        // If not the last attempt, wait before retrying
        if (attempt < retryCount) {
          await this.sleep(retryDelay);
        }
      } catch (error) {
        this.logger.error(`Failed to acquire lock for ${resource}:`, error);
      }
    }

    this.logger.debug(`Failed to acquire lock for resource: ${resource}`);
    return { acquired: false };
  }

  /**
   * Release a distributed lock
   */
  async release(resource: string, identifier: string): Promise<boolean> {
    const lockKey = this.buildLockKey(resource);

    try {
      // Use Lua script to ensure atomic check-and-delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = (await this.redisService.eval(
        script,
        [lockKey],
        [identifier],
      )) as number;

      if (result === 1) {
        this.logger.debug(`Lock released for resource: ${resource}`);
        return true;
      }

      this.logger.warn(
        `Lock not released (identifier mismatch) for resource: ${resource}`,
      );
      return false;
    } catch (error) {
      this.logger.error(`Failed to release lock for ${resource}:`, error);
      return false;
    }
  }

  /**
   * Execute a function with a distributed lock
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options?: LockOptions,
  ): Promise<T> {
    const lockResult = await this.acquire(resource, options);

    if (!lockResult.acquired) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      if (lockResult.identifier) {
        await this.release(resource, lockResult.identifier);
      }
    }
  }

  /**
   * Extend the TTL of an existing lock
   */
  async extend(
    resource: string,
    identifier: string,
    ttl: number,
  ): Promise<boolean> {
    const lockKey = this.buildLockKey(resource);

    try {
      // Use Lua script to ensure atomic check-and-extend
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = (await this.redisService.eval(
        script,
        [lockKey],
        [identifier, ttl],
      )) as number;

      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to extend lock for ${resource}:`, error);
      return false;
    }
  }

  /**
   * Check if a lock is currently held
   */
  async isLocked(resource: string): Promise<boolean> {
    const lockKey = this.buildLockKey(resource);
    return await this.redisService.exists(lockKey);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
