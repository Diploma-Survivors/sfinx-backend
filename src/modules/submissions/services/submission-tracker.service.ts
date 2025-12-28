import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { CacheKeys, RedisService } from '../../redis';

/**
 * Service responsible for initializing Redis tracking for submissions
 */
@Injectable()
export class SubmissionTrackerService {
  private static readonly REDIS_TTL_SECONDS = 3600; // 1 hour

  constructor(private readonly redisService: RedisService) {}

  /**
   * Initialize Redis keys for submission tracking
   * Sets up metadata, results hash, and seen set with TTL
   */
  async initializeTracking(
    submissionId: string,
    testcaseCount: number,
    problemId: number,
  ): Promise<void> {
    const metaKey = CacheKeys.judge0.meta(submissionId);
    const resultsKey = CacheKeys.judge0.resultsByIndex(submissionId);
    const seenKey = CacheKeys.judge0.seen(submissionId);
    const ttlSec = SubmissionTrackerService.REDIS_TTL_SECONDS;

    try {
      // Get the ioredis client for multi/pipeline operations
      const client = this.redisService.getClient();
      const tx = client.multi();

      // Set metadata hash
      tx.hset(metaKey, {
        total: String(testcaseCount),
        received: '0',
        problemId: String(problemId),
      });

      // Set TTL for all keys
      tx.expire(metaKey, ttlSec);
      tx.expire(resultsKey, ttlSec);
      tx.expire(seenKey, ttlSec);

      // Execute pipeline atomically
      await tx.exec();
    } catch (error) {
      throw new InternalServerErrorException(
        `Redis init failed for submission ${submissionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
