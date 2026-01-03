import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_ERROR_CODES } from '../constants/redis.constants';
import { LuaScript, ScanResult } from '../interfaces/redis.interfaces';

/**
 * Core Redis service providing low-level Redis operations using ioredis
 *
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private readonly loadedScripts = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Establish Redis connection
   */
  private async connect(): Promise<void> {
    try {
      const options = this.getRedisOptions();

      this.client = new Redis(options);
      this.subscriber = this.client.duplicate();

      this.client.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.client.on('ready', () => {
        this.logger.log('Redis client ready');
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis client error:', error);
      });

      this.client.on('close', () => {
        this.logger.warn('Redis client connection closed');
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis client reconnecting...');
      });

      // Wait for connection to be ready
      await this.client.ping();
      this.logger.log('Redis connection established successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw new Error(
        `${REDIS_ERROR_CODES.CONNECTION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get Redis connection options from configuration
   */
  private getRedisOptions(): RedisOptions {
    return {
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      db: this.configService.get<number>('redis.db'),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    };
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.logger.log('Redis client disconnected');
      }
      if (this.subscriber) {
        await this.subscriber.quit();
        this.logger.log('Redis subscriber disconnected');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Get the ioredis client instance for advanced operations
   * Use this when you need direct access to ioredis features like Lua scripts
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get the subscriber client for pub/sub operations
   */
  getSubscriber(): Redis {
    return this.subscriber;
  }

  /**
   * Check if Redis connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set a value with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete one or more keys
   */
  async del(keys: string | string[]): Promise<number> {
    try {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      if (keyArray.length === 0) return 0;
      return await this.client.del(...keyArray);
    } catch (error) {
      this.logger.error(`Failed to delete keys:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to set expiration for key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get multiple values by keys
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      if (keys.length === 0) return [];
      return await this.client.mget(...keys);
    } catch (error) {
      this.logger.error('Failed to get multiple keys:', error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValues: Record<string, string>): Promise<void> {
    try {
      const entries = Object.entries(keyValues);
      if (entries.length === 0) return;

      const args: string[] = [];
      entries.forEach(([key, value]) => {
        args.push(key, value);
      });

      await this.client.mset(...args);
    } catch (error) {
      this.logger.error('Failed to set multiple keys:', error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Increment a key's value
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Increment a key's value by a specific amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrby(key, increment);
    } catch (error) {
      this.logger.error(
        `Failed to increment key ${key} by ${increment}:`,
        error,
      );
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Decrement a key's value
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Failed to decrement key ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get all keys matching a pattern (use with caution in production)
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern ${pattern}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Scan keys matching a pattern (production-safe alternative to KEYS)
   */
  async scan(
    cursor: string = '0',
    pattern?: string,
    count: number = 10,
  ): Promise<ScanResult> {
    try {
      const args: (string | number)[] = [cursor];

      if (pattern) {
        args.push('MATCH', pattern);
      }

      args.push('COUNT', count);

      const result = await this.client.scan(cursor, ...(args.slice(1) as []));
      const [nextCursor, keys] = result as [string, string[]];

      return {
        cursor: nextCursor,
        keys,
      };
    } catch (error) {
      this.logger.error('Failed to scan keys:', error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete all keys matching a pattern using SCAN (production-safe)
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let totalDeleted = 0;

      do {
        const result = await this.scan(cursor, pattern, 100);
        cursor = result.cursor;

        if (result.keys.length > 0) {
          const deleted = await this.del(result.keys);
          totalDeleted += deleted;
        }
      } while (cursor !== '0');

      return totalDeleted;
    } catch (error) {
      this.logger.error(`Failed to delete keys by pattern ${pattern}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Load and cache a Lua script
   */
  async loadScript(script: LuaScript): Promise<string> {
    try {
      if (this.loadedScripts.has(script.name)) {
        return this.loadedScripts.get(script.name)!;
      }

      const sha = (await this.client.script('LOAD', script.script)) as string;
      this.loadedScripts.set(script.name, sha);

      this.logger.log(`Loaded Lua script: ${script.name} (SHA: ${sha})`);
      return sha;
    } catch (error) {
      this.logger.error(`Failed to load Lua script ${script.name}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.SCRIPT_ERROR}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Execute a loaded Lua script
   */
  async evalsha(
    scriptName: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<any> {
    try {
      const sha = this.loadedScripts.get(scriptName);
      if (!sha) {
        throw new Error(`Script ${scriptName} not loaded`);
      }

      return await this.client.evalsha(sha, keys.length, ...keys, ...args);
    } catch (error) {
      this.logger.error(`Failed to execute Lua script ${scriptName}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.SCRIPT_ERROR}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Execute a Lua script directly
   */
  async eval(
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<any> {
    try {
      return await this.client.eval(script, keys.length, ...keys, ...args);
    } catch (error) {
      this.logger.error('Failed to execute Lua script:', error);
      throw new Error(
        `${REDIS_ERROR_CODES.SCRIPT_ERROR}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Hash operations: Set a field in a hash
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hset(key, field, value);
    } catch (error) {
      this.logger.error(`Failed to hset ${key}.${field}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Hash operations: Get a field from a hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      this.logger.error(`Failed to hget ${key}.${field}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Hash operations: Get all fields and values from a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      this.logger.error(`Failed to hgetall ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Hash operations: Delete a field from a hash
   */
  async hdel(key: string, field: string | string[]): Promise<number> {
    try {
      const fields = Array.isArray(field) ? field : [field];
      return await this.client.hdel(key, ...fields);
    } catch (error) {
      this.logger.error(`Failed to hdel ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set operations: Add members to a set
   */
  async sadd(key: string, members: string | string[]): Promise<number> {
    try {
      const memberArray = Array.isArray(members) ? members : [members];
      return await this.client.sadd(key, ...memberArray);
    } catch (error) {
      this.logger.error(`Failed to sadd to ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set operations: Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Failed to smembers ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set operations: Remove members from a set
   */
  async srem(key: string, members: string | string[]): Promise<number> {
    try {
      const memberArray = Array.isArray(members) ? members : [members];
      return await this.client.srem(key, ...memberArray);
    } catch (error) {
      this.logger.error(`Failed to srem from ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * List operations: Push to the right of a list
   */
  async rpush(key: string, values: string | string[]): Promise<number> {
    try {
      const valueArray = Array.isArray(values) ? values : [values];
      return await this.client.rpush(key, ...valueArray);
    } catch (error) {
      this.logger.error(`Failed to rpush to ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * List operations: Pop from the left of a list
   */
  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lpop(key);
    } catch (error) {
      this.logger.error(`Failed to lpop from ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * List operations: Get a range of elements from a list
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Failed to lrange ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sorted Set: Add members with scores
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      this.logger.error(`Failed to zadd to ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sorted Set: Get rank (high to low)
   * Returns null if member not found
   */
  async zrevrank(key: string, member: string): Promise<number | null> {
    try {
      return await this.client.zrevrank(key, member);
    } catch (error) {
      this.logger.error(`Failed to zrevrank ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sorted Set: Get score of member
   */
  async zscore(key: string, member: string): Promise<string | null> {
    try {
      return await this.client.zscore(key, member);
    } catch (error) {
      this.logger.error(`Failed to zscore ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sorted Set: Get range (high to low) with scores
   */
  async zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores: boolean = false,
  ): Promise<string[]> {
    try {
      if (withScores) {
        return await this.client.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await this.client.zrevrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Failed to zrevrange ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sorted Set: Get cardinality (count)
   */
  async zcard(key: string): Promise<number> {
    try {
      return await this.client.zcard(key);
    } catch (error) {
      this.logger.error(`Failed to zcard ${key}:`, error);
      throw new Error(
        `${REDIS_ERROR_CODES.OPERATION_FAILED}: ${(error as Error).message}`,
      );
    }
  }
}
