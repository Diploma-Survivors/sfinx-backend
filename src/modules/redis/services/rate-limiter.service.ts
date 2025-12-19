import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RateLimitResult } from '../interfaces/redis.interfaces';
import { REDIS_PREFIX } from '../constants/redis.constants';

/**
 * Rate limiter service using Redis
 *
 * Implements sliding window rate limiting algorithm using Redis
 * for distributed rate limiting across multiple instances.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Build a rate limit key
   */
  private buildKey(identifier: string, action?: string): string {
    const parts = [REDIS_PREFIX.RATE_LIMIT, identifier];
    if (action) {
      parts.push(action);
    }
    return parts.join(':');
  }

  /**
   * Check rate limit using sliding window algorithm with Lua script
   */
  async checkLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
    action?: string,
  ): Promise<RateLimitResult> {
    const key = this.buildKey(identifier, action);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    try {
      // Lua script for atomic sliding window rate limiting
      const script = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window_start = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local window_ms = tonumber(ARGV[4])
        
        -- Remove old entries outside the window
        redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
        
        -- Count current entries in the window
        local current = redis.call('ZCARD', key)
        
        if current < limit then
          -- Add new entry
          redis.call('ZADD', key, now, now)
          redis.call('PEXPIRE', key, window_ms)
          return {1, limit - current - 1, now + window_ms}
        else
          -- Get the oldest entry to calculate retry after
          local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
          local retry_after = 0
          if #oldest > 0 then
            retry_after = math.ceil((tonumber(oldest[2]) + window_ms - now) / 1000)
          end
          return {0, 0, now + window_ms, retry_after}
        end
      `;

      const result = (await this.redisService.eval(
        script,
        [key],
        [now, windowStart, limit, windowMs],
      )) as [number, number, number, number];

      const [allowed, remaining, resetTime, retryAfter] = result;

      return {
        allowed: allowed === 1,
        remaining: remaining || 0,
        limit,
        resetTime: Math.floor(resetTime / 1000),
        retryAfter: retryAfter || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to check rate limit for ${identifier}:`, error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: limit,
        limit,
        resetTime: Math.floor((now + windowMs) / 1000),
      };
    }
  }

  /**
   * Simple counter-based rate limiting (fixed window)
   */
  async checkSimpleLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
    action?: string,
  ): Promise<RateLimitResult> {
    const key = this.buildKey(identifier, action);

    try {
      const client = this.redisService.getClient();

      // Increment counter
      const current = await client.incr(key);

      // Set expiration on first request
      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      const ttl = await client.ttl(key);
      const resetTime = Math.floor(Date.now() / 1000) + ttl;

      if (current <= limit) {
        return {
          allowed: true,
          remaining: limit - current,
          limit,
          resetTime,
        };
      } else {
        return {
          allowed: false,
          remaining: 0,
          limit,
          resetTime,
          retryAfter: ttl,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to check simple rate limit for ${identifier}:`,
        error,
      );
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: limit,
        limit,
        resetTime: Math.floor(Date.now() / 1000) + windowSeconds,
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, action?: string): Promise<void> {
    const key = this.buildKey(identifier, action);
    await this.redisService.del(key);
  }

  /**
   * Get remaining limit without incrementing
   */
  async getRemaining(
    identifier: string,
    limit: number,
    windowSeconds: number,
    action?: string,
  ): Promise<number> {
    const key = this.buildKey(identifier, action);
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const client = this.redisService.getClient();

      // Remove old entries
      await client.zremrangebyscore(key, 0, windowStart);

      // Count current entries
      const current = await client.zcard(key);

      return Math.max(0, limit - current);
    } catch (error) {
      this.logger.error(
        `Failed to get remaining limit for ${identifier}:`,
        error,
      );
      return limit;
    }
  }

  /**
   * Get reset time for rate limit
   */
  async getResetTime(
    identifier: string,
    action?: string,
  ): Promise<Date | null> {
    const key = this.buildKey(identifier, action);

    try {
      const ttl = await this.redisService.ttl(key);

      if (ttl > 0) {
        return new Date(Date.now() + ttl * 1000);
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get reset time for ${identifier}:`, error);
      return null;
    }
  }

  /**
   * Token bucket rate limiting (for burst handling)
   */
  async checkTokenBucket(
    identifier: string,
    capacity: number,
    refillRate: number,
    refillIntervalSeconds: number,
    action?: string,
  ): Promise<RateLimitResult> {
    const key = this.buildKey(identifier, action);
    const now = Date.now();

    try {
      // Lua script for token bucket algorithm
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local refill_interval_ms = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or capacity
        local last_refill = tonumber(bucket[2]) or now
        
        -- Calculate tokens to add based on time elapsed
        local elapsed = now - last_refill
        local refills = math.floor(elapsed / refill_interval_ms)
        tokens = math.min(capacity, tokens + (refills * refill_rate))
        last_refill = last_refill + (refills * refill_interval_ms)
        
        if tokens >= 1 then
          tokens = tokens - 1
          redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
          redis.call('EXPIRE', key, 3600)
          return {1, tokens, last_refill + refill_interval_ms}
        else
          local retry_after = math.ceil((refill_interval_ms - (now - last_refill)) / 1000)
          return {0, 0, last_refill + refill_interval_ms, retry_after}
        end
      `;

      const refillIntervalMs = refillIntervalSeconds * 1000;
      const result = (await this.redisService.eval(
        script,
        [key],
        [capacity, refillRate, refillIntervalMs, now],
      )) as [number, number, number, number];

      const [allowed, remaining, resetTime, retryAfter] = result;

      return {
        allowed: allowed === 1,
        remaining: Math.floor(remaining || 0),
        limit: capacity,
        resetTime: Math.floor(resetTime / 1000),
        retryAfter: retryAfter || undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check token bucket for ${identifier}:`,
        error,
      );
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: capacity,
        limit: capacity,
        resetTime: Math.floor((now + refillIntervalSeconds * 1000) / 1000),
      };
    }
  }
}
