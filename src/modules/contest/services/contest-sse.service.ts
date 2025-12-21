import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { PubSubService } from '../../redis/services/pubsub.service';
import { PUBSUB_CHANNELS } from '../../redis/constants/redis.constants';
import { ILeaderboardUpdateEvent } from '../interfaces';

/**
 * Service for managing SSE streams for contest leaderboard updates
 */
@Injectable()
export class ContestSseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContestSseService.name);

  /** Map of contestId -> Subject for SSE streams */
  private readonly contestStreams = new Map<number, Subject<MessageEvent>>();

  /** Heartbeat interval in milliseconds */
  private readonly HEARTBEAT_INTERVAL = 30000;

  constructor(private readonly pubSubService: PubSubService) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to Redis pub/sub for leaderboard updates
    await this.pubSubService.psubscribe(
      PUBSUB_CHANNELS.CONTEST_LEADERBOARD_PATTERN,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.handleLeaderboardUpdate.bind(this),
    );

    this.logger.log('Subscribed to contest leaderboard updates');
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup subscriptions
    await this.pubSubService.punsubscribe(
      PUBSUB_CHANNELS.CONTEST_LEADERBOARD_PATTERN,
    );

    // Complete all subjects
    this.contestStreams.forEach((subject, contestId) => {
      subject.complete();
      this.logger.debug(`Closed SSE stream for contest ${contestId}`);
    });
    this.contestStreams.clear();

    this.logger.log('Unsubscribed from contest leaderboard updates');
  }

  /**
   * Get SSE observable for a contest's leaderboard
   * Includes heartbeat to keep connection alive
   */
  getLeaderboardStream(contestId: number): Observable<MessageEvent> {
    if (!this.contestStreams.has(contestId)) {
      this.contestStreams.set(contestId, new Subject<MessageEvent>());
      this.logger.debug(`Created SSE stream for contest ${contestId}`);
    }

    const dataStream = this.contestStreams.get(contestId)!.asObservable();

    // Add heartbeat every 30 seconds to keep connection alive
    const heartbeatStream = interval(this.HEARTBEAT_INTERVAL).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
            type: 'ping',
          }) as MessageEvent,
      ),
    );

    return merge(dataStream, heartbeatStream);
  }

  /**
   * Handle incoming Redis pub/sub message
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async handleLeaderboardUpdate(
    pattern: string,
    channel: string,
    message: string,
  ): Promise<void> {
    try {
      const data = JSON.parse(message) as ILeaderboardUpdateEvent;
      const subject = this.contestStreams.get(data.contestId);

      if (subject) {
        subject.next({
          data: message,
          type: 'leaderboard_update',
        } as MessageEvent);

        this.logger.debug(
          `Broadcast leaderboard update for contest ${data.contestId}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to process leaderboard update', error);
    }
  }

  /**
   * Publish leaderboard update (convenience method)
   */
  async publishUpdate(contestId: number, data: unknown): Promise<void> {
    const channel = `contest:${contestId}:leaderboard`;
    await this.pubSubService.publish(channel, JSON.stringify(data));
  }

  /**
   * Cleanup stream when contest ends
   */
  cleanupContestStream(contestId: number): void {
    const subject = this.contestStreams.get(contestId);
    if (subject) {
      // Send end event
      subject.next({
        data: JSON.stringify({ type: 'contest_ended', contestId }),
        type: 'end',
      } as MessageEvent);

      subject.complete();
      this.contestStreams.delete(contestId);

      this.logger.log(`Cleaned up SSE stream for contest ${contestId}`);
    }
  }

  /**
   * Get active stream count (for monitoring)
   */
  getActiveStreamCount(): number {
    return this.contestStreams.size;
  }

  /**
   * Check if a contest has active listeners
   */
  hasActiveListeners(contestId: number): boolean {
    return this.contestStreams.has(contestId);
  }
}
