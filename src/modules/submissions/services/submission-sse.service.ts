import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, ReplaySubject } from 'rxjs';

import { PubSubService } from '../../redis';
import {
  SUBMISSION_CHANNELS,
  SUBMISSION_SSE,
} from '../constants/submission.constants';
import { SubmissionEvent } from '../enums/submission-event.enum';

/**
 * Message event interface for SSE
 */
export interface MessageEvent {
  type: string;
  data: unknown;
}

/**
 * Payload structure for submission result events
 */
interface SubmissionResultPayload {
  submissionId: string;
  payload: unknown;
}

/**
 * Service for managing Server-Sent Events (SSE) streams for submission results
 * Handles real-time streaming of submission results to connected clients
 */
@Injectable()
export class SubmissionSseService implements OnModuleInit {
  private readonly logger = new Logger(SubmissionSseService.name);

  /** Map of submission ID to ReplaySubject for streaming */
  private readonly streams = new Map<string, ReplaySubject<MessageEvent>>();

  /** Map of submission ID to cleanup timer */
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to submission result events from Redis
    await this.pubSubService.subscribe(
      SUBMISSION_CHANNELS.RESULT_READY,
      (_channel: string, message: string) => {
        try {
          const { submissionId, payload } = JSON.parse(
            message,
          ) as SubmissionResultPayload;
          this.forwardEvent(submissionId, payload);
        } catch (error) {
          this.logger.error(
            'Invalid pub/sub message',
            error instanceof Error ? error.stack : error,
          );
        }
      },
    );
  }

  /**
   * Connect a client to a submission stream
   * Creates a new stream if one doesn't exist
   * Cancels any pending cleanup for this submission
   */
  connect(submissionId: string): Observable<MessageEvent> {
    let stream = this.streams.get(submissionId);
    if (!stream) {
      stream = new ReplaySubject<MessageEvent>(
        SUBMISSION_SSE.REPLAY_BUFFER_SIZE,
      );
      this.streams.set(submissionId, stream);
    }

    // Cancel any pending cleanup
    const timer = this.cleanupTimers.get(submissionId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(submissionId);
    }

    return stream.asObservable();
  }

  /**
   * Forward an event to the appropriate submission stream
   * Creates a new stream if one doesn't exist
   * Schedules cleanup after configured time
   */
  forwardEvent(submissionId: string, data: unknown): void {
    let stream = this.streams.get(submissionId);
    if (!stream) {
      stream = new ReplaySubject<MessageEvent>(
        SUBMISSION_SSE.REPLAY_BUFFER_SIZE,
      );
      this.streams.set(submissionId, stream);
    }

    const event: MessageEvent = {
      type: SubmissionEvent.RESULT,
      data: data,
    };
    stream.next(event);

    // Schedule cleanup if not already scheduled
    if (!this.cleanupTimers.has(submissionId)) {
      const cleanupMs = this.configService.get<number>(
        'submission.cleanupStreamTime',
      );
      const timer = setTimeout(() => this.cleanup(submissionId), cleanupMs);
      this.cleanupTimers.set(submissionId, timer);
    }
  }

  /**
   * Cleanup a submission stream
   * Completes the stream and removes it from memory
   */
  cleanup(submissionId: string): void {
    const stream = this.streams.get(submissionId);
    if (stream) {
      stream.complete();
      this.streams.delete(submissionId);
    }

    const timer = this.cleanupTimers.get(submissionId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(submissionId);
    }

    this.logger.debug(`Cleaned up stream for submission ${submissionId}`);
  }
}
