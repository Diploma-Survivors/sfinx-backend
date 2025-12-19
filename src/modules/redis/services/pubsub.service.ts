import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from './redis.service';
import {
  MessageHandler,
  PatternMessageHandler,
} from '../interfaces/redis.interfaces';

/**
 * Redis Pub/Sub service for real-time messaging
 *
 * Provides publish/subscribe functionality using Redis pub/sub
 * for real-time event broadcasting across distributed systems.
 */
@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private readonly subscriptions = new Map<string, MessageHandler[]>();
  private readonly patternSubscriptions = new Map<
    string,
    PatternMessageHandler[]
  >();

  constructor(private readonly redisService: RedisService) {}

  onModuleInit() {
    this.setupSubscriber();
  }

  async onModuleDestroy() {
    await this.unsubscribeAll();
  }

  /**
   * Setup subscriber event handlers
   */
  private setupSubscriber(): void {
    const subscriber = this.redisService.getSubscriber();

    subscriber.on('message', (channel: string, message: string) => {
      void this.handleMessage(channel, message);
    });

    subscriber.on(
      'pmessage',
      (pattern: string, channel: string, message: string) => {
        void this.handlePatternMessage(pattern, channel, message);
      },
    );

    subscriber.on('subscribe', (channel: string, count: number) => {
      this.logger.debug(`Subscribed to channel: ${channel} (total: ${count})`);
    });

    subscriber.on('unsubscribe', (channel: string, count: number) => {
      this.logger.debug(
        `Unsubscribed from channel: ${channel} (remaining: ${count})`,
      );
    });

    subscriber.on('psubscribe', (pattern: string, count: number) => {
      this.logger.debug(`Subscribed to pattern: ${pattern} (total: ${count})`);
    });

    subscriber.on('punsubscribe', (pattern: string, count: number) => {
      this.logger.debug(
        `Unsubscribed from pattern: ${pattern} (remaining: ${count})`,
      );
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(channel: string, message: string): Promise<void> {
    const handlers = this.subscriptions.get(channel);
    if (!handlers || handlers.length === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(channel, message);
      } catch (error) {
        this.logger.error(
          `Error handling message on channel ${channel}:`,
          error,
        );
      }
    }
  }

  /**
   * Handle incoming pattern message
   */
  private async handlePatternMessage(
    pattern: string,
    channel: string,
    message: string,
  ): Promise<void> {
    const handlers = this.patternSubscriptions.get(pattern);
    if (!handlers || handlers.length === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(pattern, channel, message);
      } catch (error) {
        this.logger.error(
          `Error handling pattern message on ${pattern} (${channel}):`,
          error,
        );
      }
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: any): Promise<number> {
    try {
      const serialized =
        typeof message === 'string' ? message : JSON.stringify(message);
      const client = this.redisService.getClient();
      const subscribers = await client.publish(channel, serialized);

      this.logger.debug(
        `Published to ${channel}, received by ${subscribers} subscribers`,
      );
      return subscribers;
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    try {
      // Add handler to subscriptions
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, []);
      }
      this.subscriptions.get(channel)!.push(handler);

      // Subscribe to channel if this is the first handler
      if (this.subscriptions.get(channel)!.length === 1) {
        const subscriber = this.redisService.getSubscriber();
        await subscriber.subscribe(channel);
      }
    } catch (error) {
      this.logger.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    try {
      const handlers = this.subscriptions.get(channel);
      if (!handlers) {
        return;
      }

      if (handler) {
        // Remove specific handler
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      } else {
        // Remove all handlers
        handlers.length = 0;
      }

      // Unsubscribe from channel if no handlers left
      if (handlers.length === 0) {
        const subscriber = this.redisService.getSubscriber();
        await subscriber.unsubscribe(channel);
        this.subscriptions.delete(channel);
      }
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from channel ${channel}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Subscribe to a pattern
   */
  async psubscribe(
    pattern: string,
    handler: PatternMessageHandler,
  ): Promise<void> {
    try {
      // Add handler to pattern subscriptions
      if (!this.patternSubscriptions.has(pattern)) {
        this.patternSubscriptions.set(pattern, []);
      }
      this.patternSubscriptions.get(pattern)!.push(handler);

      // Subscribe to pattern if this is the first handler
      if (this.patternSubscriptions.get(pattern)!.length === 1) {
        const subscriber = this.redisService.getSubscriber();
        await subscriber.psubscribe(pattern);
      }
    } catch (error) {
      this.logger.error(`Failed to subscribe to pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a pattern
   */
  async punsubscribe(
    pattern: string,
    handler?: PatternMessageHandler,
  ): Promise<void> {
    try {
      const handlers = this.patternSubscriptions.get(pattern);
      if (!handlers) {
        return;
      }

      if (handler) {
        // Remove specific handler
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      } else {
        // Remove all handlers
        handlers.length = 0;
      }

      // Unsubscribe from pattern if no handlers left
      if (handlers.length === 0) {
        const subscriber = this.redisService.getSubscriber();
        await subscriber.punsubscribe(pattern);
        this.patternSubscriptions.delete(pattern);
      }
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from pattern ${pattern}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Unsubscribe from all channels and patterns
   */
  async unsubscribeAll(): Promise<void> {
    try {
      const subscriber = this.redisService.getSubscriber();

      if (this.subscriptions.size > 0) {
        await subscriber.unsubscribe();
        this.subscriptions.clear();
      }

      if (this.patternSubscriptions.size > 0) {
        await subscriber.punsubscribe();
        this.patternSubscriptions.clear();
      }
    } catch (error) {
      this.logger.error('Failed to unsubscribe from all:', error);
      throw error;
    }
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get active pattern subscriptions
   */
  getPatternSubscriptions(): string[] {
    return Array.from(this.patternSubscriptions.keys());
  }

  /**
   * Publish a typed event (convenience method)
   */
  async publishEvent<T>(
    channel: string,
    event: string,
    data: T,
  ): Promise<number> {
    const message = {
      event,
      data,
      timestamp: Date.now(),
    };
    return await this.publish(channel, message);
  }

  /**
   * Subscribe to typed events (convenience method)
   */
  async subscribeToEvent<T>(
    channel: string,
    event: string,
    handler: (data: T) => void | Promise<void>,
  ): Promise<void> {
    const messageHandler: MessageHandler = async (
      ch: string,
      message: string,
    ) => {
      try {
        const parsed = JSON.parse(message) as { event: string; data: T };
        if (parsed.event === event) {
          await handler(parsed.data);
        }
      } catch (error) {
        this.logger.error(`Failed to parse event message:`, error);
      }
    };

    await this.subscribe(channel, messageHandler);
  }
}
