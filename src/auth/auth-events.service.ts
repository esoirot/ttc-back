import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Observable } from 'rxjs';
import { createRedisClientPair } from '../common/realtime/redis-pubsub.util';
import { RealtimeChannelRegistry } from '../common/realtime/realtime-channel-registry';

type AuthEvent = { type: 'session_revoked' };

const CHANNEL_PREFIX = 'auth:';

@Injectable()
export class AuthEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEventsService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly registry: RealtimeChannelRegistry<AuthEvent>;

  constructor(private readonly configService: ConfigService) {
    const { publisher, subscriber } = createRedisClientPair(this.configService);
    this.publisher = publisher;
    this.subscriber = subscriber;
    this.registry = new RealtimeChannelRegistry<AuthEvent>({
      subscriber: this.subscriber,
      logger: this.logger,
      redisChannelPrefix: CHANNEL_PREFIX,
      gated: false,
      parseMessage: (message) => JSON.parse(message) as AuthEvent,
      onBadPayload: (key) =>
        this.logger.warn(`Bad auth event payload user=${key}`),
      onSubscribeFailed: (key, err) =>
        this.logger.error(`Redis auth subscribe failed user=${key}`, err),
      onUnsubscribeFailed: (key, err) =>
        this.logger.warn(`Redis auth unsubscribe failed user=${key}`, err),
    });
  }

  onModuleInit(): void {
    this.subscriber.on('error', (err: unknown) =>
      this.logger.error('Redis auth subscriber error', err),
    );
    this.subscriber.on('reconnecting', () =>
      this.logger.warn('Redis auth subscriber reconnecting'),
    );
  }

  async publish(userId: number, event: AuthEvent): Promise<void> {
    try {
      await this.publisher.publish(
        `${CHANNEL_PREFIX}${userId}`,
        JSON.stringify(event),
      );
    } catch (err) {
      this.logger.error('Auth event publish failed', err);
    }
  }

  subscribe(userId: number): Observable<AuthEvent> {
    return this.registry.subscribe(String(userId));
  }

  async onModuleDestroy(): Promise<void> {
    this.registry.destroy();
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}
