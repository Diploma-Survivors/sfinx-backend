import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/services/redis.service';

const CACHE_PREFIX = 'prompt';
const DEFAULT_TTL_SECONDS = 300;

export interface CachedPromptData {
  template: string;
  version: number;
  fetchedAt: string;
}

@Injectable()
export class PromptCacheService {
  private readonly logger = new Logger(PromptCacheService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private buildKey(name: string, label: string): string {
    return `${CACHE_PREFIX}:${name}:${label}`;
  }

  private getTtl(): number {
    return (
      this.configService.get<number>('PROMPT_CACHE_TTL') ?? DEFAULT_TTL_SECONDS
    );
  }

  async get(name: string, label: string): Promise<CachedPromptData | null> {
    try {
      const raw = await this.redisService.get(this.buildKey(name, label));
      if (!raw) return null;
      return JSON.parse(raw) as CachedPromptData;
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for cache get (${name}:${label}):`,
        error,
      );
      return null;
    }
  }

  async set(
    name: string,
    label: string,
    data: CachedPromptData,
  ): Promise<void> {
    try {
      await this.redisService.set(
        this.buildKey(name, label),
        JSON.stringify(data),
        this.getTtl(),
      );
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for cache set (${name}:${label}):`,
        error,
      );
    }
  }

  async invalidate(name: string, label: string): Promise<void> {
    try {
      await this.redisService.del(this.buildKey(name, label));
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate prompt cache (${name}:${label}):`,
        error,
      );
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      await this.redisService.deleteByPattern(`${CACHE_PREFIX}:*`);
    } catch (error) {
      this.logger.warn('Failed to invalidate all prompt caches:', error);
    }
  }
}
