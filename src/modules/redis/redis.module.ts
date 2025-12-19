import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { CacheService } from './services/cache.service';
import { LockService } from './services/lock.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { PubSubService } from './services/pubsub.service';
import { RedisHealthIndicator } from './health/redis.health';

/**
 * Redis module providing comprehensive Redis functionality
 *
 * This module is global and exports all Redis-related services:
 * - RedisService: Core ioredis client with Lua script support
 * - CacheService: High-level caching with automatic serialization
 * - LockService: Distributed locking
 * - RateLimiterService: Rate limiting with sliding window and token bucket
 * - PubSubService: Pub/sub messaging
 * - RedisHealthIndicator: Health checks
 *
 * @example
 * ```typescript
 * // In your service
 * constructor(
 *   private readonly redisService: RedisService,
 *   private readonly cacheService: CacheService,
 * ) {}
 *
 * // Use ioredis directly for Lua scripts
 * const client = this.redisService.getClient();
 * await client.eval(luaScript, ...);
 *
 * // Or use high-level cache service
 * await this.cacheService.set('key', data, { ttl: 3600 });
 * ```
 */
@Global()
@Module({
  providers: [
    RedisService,
    CacheService,
    LockService,
    RateLimiterService,
    PubSubService,
    RedisHealthIndicator,
  ],
  exports: [
    RedisService,
    CacheService,
    LockService,
    RateLimiterService,
    PubSubService,
    RedisHealthIndicator,
  ],
})
export class RedisModule {}
