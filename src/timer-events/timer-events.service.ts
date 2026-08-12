import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Observable } from 'rxjs';
import type { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { createRedisClientPair } from '../common/realtime/redis-pubsub.util';
import { RealtimeChannelRegistry } from '../common/realtime/realtime-channel-registry';

export interface TimerEventsStats {
  channels: number;
  active_sse_subscriptions: number;
}

const MAX_SSE_PER_USER = 5;
const CHANNEL_PREFIX = 'timer:';

@Injectable()
export class TimerEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimerEventsService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly registry: RealtimeChannelRegistry<TimeEntry | null>;

  constructor(private readonly configService: ConfigService) {
    const { publisher, subscriber } = createRedisClientPair(this.configService);
    this.publisher = publisher;
    this.subscriber = subscriber;
    this.registry = new RealtimeChannelRegistry<TimeEntry | null>({
      subscriber: this.subscriber,
      logger: this.logger,
      redisChannelPrefix: CHANNEL_PREFIX,
      gated: true,
      parseMessage: (message) =>
        message === 'null' ? null : (JSON.parse(message) as TimeEntry),
      onBadPayload: (key) => this.logger.warn(`Bad timer payload user=${key}`),
      onSubscribeFailed: (key, err) =>
        this.logger.error(`Redis subscribe failed timer:${key}`, err),
      onUnsubscribeFailed: (key, err) =>
        this.logger.warn(`Redis unsubscribe failed timer:${key}`, err),
    });
  }

  onModuleInit(): void {
    this.subscriber.on('error', (err: unknown) =>
      this.logger.error('Redis subscriber error', err),
    );
    this.subscriber.on('reconnecting', () =>
      this.logger.warn('Redis subscriber reconnecting'),
    );
    this.subscriber.on('ready', () => {
      // ioredis autoResubscribe re-sends SUBSCRIBE for all channels after reconnect.
      // Log active channel count here as a post-reconnect sanity check.
      this.logger.log(
        `Redis subscriber ready (active channels: ${this.registry.size})`,
      );
    });
    this.publisher.on('error', (err: unknown) =>
      this.logger.error('Redis publisher error', err),
    );
    this.publisher.on('reconnecting', () =>
      this.logger.warn('Redis publisher reconnecting'),
    );
  }

  async publish(userId: number, entry: TimeEntry | null): Promise<void> {
    try {
      const payload = JSON.stringify(entry);
      await this.publisher.publish(`${CHANNEL_PREFIX}${userId}`, payload);
    } catch (err) {
      this.logger.error('Publish failed', err);
    }
  }

  subscribe(userId: number): Observable<TimeEntry | null> {
    const key = String(userId);

    return new Observable<TimeEntry | null>((observer) => {
      if (this.registry.getRefCount(key) >= MAX_SSE_PER_USER) {
        throw new HttpException(
          'SSE connection limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const sub = this.registry.subscribe(key).subscribe(observer);
      return () => sub.unsubscribe();
    });
  }

  getStats(): TimerEventsStats {
    return this.registry.getStats();
  }

  async onModuleDestroy(): Promise<void> {
    this.registry.destroy();
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}
