import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheOptions } from '../interfaces/redis.interfaces';
import { REDIS_PREFIX, REDIS_TTL } from '../constants/redis.constants';

/**
 * High-level cache service with automatic serialization/deserialization
 *
 * This service follows the Single Responsibility Principle by focusing on
 * caching operations with JSON serialization, while delegating Redis operations
 * to RedisService (Dependency Inversion Principle).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultPrefix = REDIS_PREFIX.CACHE;
  private readonly defaultTtl = REDIS_TTL.ONE_HOUR;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Build a cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.defaultPrefix;
    return `${finalPrefix}:${key}`;
  }

  /**
   * Get a cached value with automatic deserialization
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await this.redisService.get(cacheKey);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a cached value with automatic serialization
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl || this.defaultTtl;

      await this.redisService.set(cacheKey, serialized, ttl);

      // Store tags for invalidation if provided
      if (options?.tags && options.tags.length > 0) {
        await this.addTagsToKey(cacheKey, options.tags);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get or set a cached value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      // If not in cache, execute factory function
      const value = await factory();

      // Store in cache
      await this.set(key, value, options);

      return value;
    } catch (error) {
      this.logger.error(`Failed to getOrSet for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete cached value(s)
   */
  async invalidate(keys: string | string[], prefix?: string): Promise<void> {
    try {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      const cacheKeys = keyArray.map((key) => this.buildKey(key, prefix));

      await this.redisService.del(cacheKeys);
    } catch (error) {
      this.logger.error('Failed to invalidate cache:', error);
      throw error;
    }
  }

  /**
   * Delete all cached values matching a pattern
   */
  async invalidateByPattern(pattern: string, prefix?: string): Promise<number> {
    try {
      const finalPrefix = prefix || this.defaultPrefix;
      const fullPattern = `${finalPrefix}:${pattern}`;

      return await this.redisService.deleteByPattern(fullPattern);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache by pattern ${pattern}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete all cached values associated with specific tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.redisService.smembers(tagKey);

        if (keys.length > 0) {
          await this.redisService.del(keys);
          await this.redisService.del(tagKey);
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate cache by tags:', error);
      throw error;
    }
  }

  /**
   * Get multiple cached values
   */
  async mget<T>(keys: string[], prefix?: string): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map((key) => this.buildKey(key, prefix));
      const values = await this.redisService.mget(cacheKeys);

      return values.map((value) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error('Failed to mget cache:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple cached values
   */
  async mset<T>(
    items: Array<{ key: string; value: T; ttl?: number }>,
    prefix?: string,
  ): Promise<void> {
    try {
      // Set all values without TTL first
      const keyValues: Record<string, string> = {};
      items.forEach((item) => {
        const cacheKey = this.buildKey(item.key, prefix);
        keyValues[cacheKey] = JSON.stringify(item.value);
      });

      await this.redisService.mset(keyValues);

      // Set TTL for each key if specified
      for (const item of items) {
        if (item.ttl) {
          const cacheKey = this.buildKey(item.key, prefix);
          await this.redisService.expire(cacheKey, item.ttl);
        }
      }
    } catch (error) {
      this.logger.error('Failed to mset cache:', error);
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string, prefix?: string): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, prefix);
      return await this.redisService.exists(cacheKey);
    } catch (error) {
      this.logger.error(
        `Failed to check cache existence for key ${key}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get the TTL of a cached key
   */
  async getTtl(key: string, prefix?: string): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, prefix);
      return await this.redisService.ttl(cacheKey);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Warm the cache with a value
   */
  async warm<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<void> {
    try {
      const value = await factory();
      await this.set(key, value, options);
      this.logger.log(`Cache warmed for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to warm cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment a numeric cache value
   */
  async increment(
    key: string,
    increment: number = 1,
    prefix?: string,
  ): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, prefix);
      return await this.redisService.incrby(cacheKey, increment);
    } catch (error) {
      this.logger.error(`Failed to increment cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrement a numeric cache value
   */
  async decrement(
    key: string,
    decrement: number = 1,
    prefix?: string,
  ): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, prefix);
      return await this.redisService.incrby(cacheKey, -decrement);
    } catch (error) {
      this.logger.error(`Failed to decrement cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add tags to a cache key for tag-based invalidation
   */
  private async addTagsToKey(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        await this.redisService.sadd(tagKey, key);
      }
    } catch (error) {
      this.logger.error('Failed to add tags to key:', error);
    }
  }

  /**
   * Build a tag key
   */
  private buildTagKey(tag: string): string {
    return `${this.defaultPrefix}:tag:${tag}`;
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(prefix?: string): Promise<number> {
    try {
      const finalPrefix = prefix || this.defaultPrefix;
      const pattern = `${finalPrefix}:*`;

      const deleted = await this.redisService.deleteByPattern(pattern);
      this.logger.warn(
        `Cleared ${deleted} cache entries with prefix: ${finalPrefix}`,
      );

      return deleted;
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw error;
    }
  }
}
