import { InjectQueue } from '@nestjs/bullmq';
import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackoffOptions } from 'bullmq';
import { Queue } from 'bullmq';

import { Judge0Response } from '../../judge0/interfaces';
import {
  CacheKeys,
  LockService,
  PubSubService,
  RedisService,
} from '../../redis';
import {
  SUBMISSION_CHANNELS,
  SUBMISSION_JOBS,
  SUBMISSION_PROCESSING,
  SUBMISSION_QUEUES,
} from '../constants/submission.constants';
import { SubmissionResultDto } from '../dto/submission-result.dto';
import { SubmissionResultBuilderService } from './submission-result-builder.service';
import { SubmissionsService } from '../submissions.service';

/**
 * Lua script to add a result by index with deduplication and first-writer-wins logic.
 */
const LUA_ADD_RESULT = {
  name: 'addResultByIndex',
  numberOfKeys: 3,
  script: `
-- KEYS[1]=resultsI (hash index->json)
-- KEYS[2]=meta     (hash)
-- KEYS[3]=seen     (set)
-- ARGV[1]=token
-- ARGV[2]=index
-- ARGV[3]=json
-- Return: {added(0|1), received, total}

local resultsI = KEYS[1]
local meta     = KEYS[2]
local seen     = KEYS[3]
local token    = ARGV[1]
local index    = ARGV[2]
local json     = ARGV[3]

-- Deduplication by token
local isNew = redis.call('SADD', seen, token)
if isNew == 0 then
  local received = redis.call('HGET', meta, 'received') or '0'
  local total    = redis.call('HGET', meta, 'total') or '0'
  return {0, received, total}
end

-- Write by index (first-writer-wins)
if redis.call('HEXISTS', resultsI, index) == 0 then
  redis.call('HSET', resultsI, index, json)
end

local received = redis.call('HINCRBY', meta, 'received', 1)
local total    = redis.call('HGET', meta, 'total') or '0'
return {1, tostring(received), total}
`,
};

/**
 * Service responsible for processing Judge0 callbacks and finalizing submissions
 * Orchestrates the callback workflow and delegates to specialized services
 * Refactored to use event-driven architecture via SubmissionsService
 */
@Injectable()
export class CallbackProcessorService implements OnModuleInit {
  private readonly logger = new Logger(CallbackProcessorService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly pubSubService: PubSubService,
    private readonly lockService: LockService,
    @InjectQueue(SUBMISSION_QUEUES.FINALIZE)
    private readonly finalizeQueue: Queue,
    private readonly configService: ConfigService,
    private readonly resultBuilder: SubmissionResultBuilderService,
    @Inject(forwardRef(() => SubmissionsService))
    private readonly submissionsService: SubmissionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Load Lua script
    await this.redisService.loadScript(LUA_ADD_RESULT);
    this.logger.log('Callback processor initialized');
  }

  /**
   * Handle a single testcase callback from Judge0
   */
  async handleCallback(
    submissionId: string,
    index: number,
    payload: Judge0Response,
    isSubmit: boolean,
  ): Promise<void> {
    this.logger.debug(
      `[${submissionId}] Processing callback for testcase ${index}, token: ${payload.token}, status: ${payload.status.id}`,
    );

    const { added, received, total } = await this.addResult(
      submissionId,
      index,
      payload,
    );

    this.logger.log(
      `[${submissionId}] Callback handled - testcase ${index}: added=${added}, received=${received}/${total}`,
    );

    // If all results received, schedule finalization
    if (added && received >= total) {
      this.logger.log(
        `[${submissionId}] All results received (${received}/${total}), scheduling finalization`,
      );
      await this.tryScheduleFinalize(submissionId, isSubmit);
    } else if (!added) {
      this.logger.warn(
        `[${submissionId}] Duplicate callback for testcase ${index}, token: ${payload.token}`,
      );
    }
  }

  /**
   * Finalize a submission after all testcase results are received
   * Called by the queue processor
   */
  async finalizer(submissionId: string, isSubmit: boolean): Promise<void> {
    try {
      this.logger.log('Finalizer started', { submissionId, isSubmit });

      const metaKey = CacheKeys.judge0.meta(submissionId);
      const resultsIKey = CacheKeys.judge0.resultsByIndex(submissionId);
      const seenKey = CacheKeys.judge0.seen(submissionId);

      // Get metadata and results
      const meta = await this.redisService.hgetall(metaKey);
      const results = await this.redisService.hgetall(resultsIKey);

      // Clean up Redis keys
      await this.cleanupRedisKeys([metaKey, resultsIKey, seenKey]);

      // Aggregate test results
      const testResults = this.resultBuilder.aggregateTestResults(results);
      let finalResult: SubmissionResultDto;

      if (isSubmit) {
        // For submit mode: update database submission and emit events
        finalResult =
          await this.resultBuilder.buildSubmissionResultForSubmitMode(
            testResults,
            Number.parseInt(meta.problemId),
          );

        // Use SubmissionsService to update submission (triggers events)
        await this.submissionsService.updateSubmissionAfterJudge(
          Number.parseInt(submissionId),
          finalResult.status,
          finalResult.passedTests,
          finalResult.totalTests,
          finalResult.runtime,
          finalResult.memory,
          finalResult.resultDescription,
        );
      } else {
        // For run mode: just build result (no DB update)
        finalResult = await this.resultBuilder.buildSubmissionResultForRunMode(
          testResults,
          Number.parseInt(meta.problemId),
        );
      }

      // Publish result via Redis Pub/Sub
      await this.publishFinalize(submissionId, finalResult);

      this.logger.log('Finalizer completed', { submissionId });
    } catch (error) {
      this.logger.error(
        `Finalizer failed for submission ${submissionId}:`,
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Try to schedule finalize job with distributed lock
   */
  private async tryScheduleFinalize(
    submissionId: string,
    isSubmit: boolean,
  ): Promise<void> {
    const lockResult = await this.lockService.acquire(
      `finalize:${submissionId}`,
      { ttl: SUBMISSION_PROCESSING.LOCK_TTL * 1000 }, // Convert to milliseconds
    );

    if (lockResult.acquired) {
      this.logger.log(
        `[${submissionId}] Lock acquired. Scheduling finalize job.`,
      );
      await this.scheduleFinalizeJob(submissionId, isSubmit);
    } else {
      this.logger.warn(
        `[${submissionId}] Lock already held, skipping finalize scheduling.`,
      );
    }
  }

  /**
   * Schedule a finalize job in the queue
   */
  private async scheduleFinalizeJob(
    submissionId: string,
    isSubmit: boolean,
  ): Promise<void> {
    const jobName = isSubmit
      ? SUBMISSION_JOBS.FINALIZE_SUBMIT
      : SUBMISSION_JOBS.FINALIZE_RUN;

    try {
      await this.finalizeQueue.add(
        jobName,
        { submissionId, isSubmit },
        {
          jobId: `finalize-${submissionId}`,
          attempts: this.configService.get<number>('submission.job.attempts'),
          backoff: this.configService.get<object>(
            'submission.job.backoff',
          ) as BackoffOptions,
          removeOnComplete: this.configService.get<boolean>(
            'submission.job.removeOnComplete',
          ),
          removeOnFail: this.configService.get<number>(
            'submission.job.removeOnFail',
          ),
        },
      );

      this.logger.log(
        `[${submissionId}] Finalize job added to queue: ${jobName}`,
      );
    } catch (error) {
      this.logger.error(
        `[${submissionId}] Failed to add finalize job to queue`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clean up Redis keys after finalization
   */
  private async cleanupRedisKeys(keys: string[]): Promise<void> {
    await this.redisService.del(keys);
  }

  /**
   * Add a result using Lua script
   */
  private async addResult(
    submissionId: string,
    index: number,
    payload: Judge0Response,
  ): Promise<{ added: boolean; received: number; total: number }> {
    const metaKey = CacheKeys.judge0.meta(submissionId);
    const resultsIKey = CacheKeys.judge0.resultsByIndex(submissionId);
    const seenKey = CacheKeys.judge0.seen(submissionId);

    const toStore = {
      index,
      token: payload.token,
      status: payload.status,
      stdout: payload.stdout,
      stderr: payload.stderr,
      time: payload.time,
      memory: payload.memory,
      compile_output: payload.compile_output,
      message: payload.message,
    };

    try {
      this.logger.debug(
        `[${submissionId}] Storing result for testcase ${index} in Redis`,
      );

      const result = (await this.redisService.evalsha(
        LUA_ADD_RESULT.name,
        [resultsIKey, metaKey, seenKey],
        [payload.token, String(index), JSON.stringify(toStore)],
      )) as [number, string, string];

      const returnValue = {
        added: result[0] === 1,
        received: Number.parseInt(result[1]),
        total: Number.parseInt(result[2]),
      };

      this.logger.debug(
        `[${submissionId}] Redis Lua result: added=${returnValue.added}, received=${returnValue.received}, total=${returnValue.total}`,
      );

      return returnValue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${submissionId}] Redis error storing testcase ${index}: ${msg}`,
      );
      if (err instanceof Error && err.stack) {
        this.logger.debug(`[${submissionId}] Stack trace:`, err.stack);
      }
      return { added: false, received: 0, total: 0 };
    }
  }

  /**
   * Publish finalization result via Redis Pub/Sub
   */
  async publishFinalize(
    submissionId: string,
    payload: SubmissionResultDto,
  ): Promise<void> {
    await this.pubSubService.publish(SUBMISSION_CHANNELS.RESULT_READY, {
      submissionId,
      payload,
    });

    this.logger.log(`Published finalize for ${submissionId}`);
  }
}
