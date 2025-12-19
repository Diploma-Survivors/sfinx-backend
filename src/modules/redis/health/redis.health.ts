import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../services/redis.service';

/**
 * Simple Redis health check service
 *
 * Provides basic health checking functionality without requiring @nestjs/terminus
 */
@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      return await this.redisService.isHealthy();
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(): Promise<{
    status: 'up' | 'down';
    message: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.redisService.isHealthy();
      const responseTime = Date.now() - startTime;

      return {
        status: isHealthy ? 'up' : 'down',
        message: isHealthy ? 'Redis is responding' : 'Redis is not responding',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      };
    }
  }
}
