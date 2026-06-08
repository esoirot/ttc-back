import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { Observable, Subject } from 'rxjs';

type AuthEvent = { type: 'session_revoked' };

const REDIS_OPTIONS: RedisOptions = {
  autoResubscribe: true,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5_000),
};

interface ChannelEntry {
  readonly subject: Subject<AuthEvent>;
  refCount: number;
}

@Injectable()
export class AuthEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEventsService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly channels = new Map<string, ChannelEntry>();

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.publisher = new Redis(url, REDIS_OPTIONS);
    this.subscriber = new Redis(url, REDIS_OPTIONS);
  }

  onModuleInit(): void {
    this.subscriber.on('message', (channel: string, message: string) => {
      const key = channel.replace('auth:', '');
      const entry = this.channels.get(key);
      if (!entry) return;
      try {
        entry.subject.next(JSON.parse(message) as AuthEvent);
      } catch {
        this.logger.warn(`Bad auth event payload user=${key}`);
      }
    });

    this.subscriber.on('error', (err: unknown) =>
      this.logger.error('Redis auth subscriber error', err),
    );
    this.subscriber.on('reconnecting', () =>
      this.logger.warn('Redis auth subscriber reconnecting'),
    );
  }

  async publish(userId: number, event: AuthEvent): Promise<void> {
    try {
      await this.publisher.publish(`auth:${userId}`, JSON.stringify(event));
    } catch (err) {
      this.logger.error('Auth event publish failed', err);
    }
  }

  subscribe(userId: number): Observable<AuthEvent> {
    const key = String(userId);

    return new Observable<AuthEvent>((observer) => {
      let entry = this.channels.get(key);
      if (!entry) {
        entry = { subject: new Subject<AuthEvent>(), refCount: 0 };
        this.channels.set(key, entry);
        this.subscriber
          .subscribe(`auth:${key}`)
          .catch((err: unknown) =>
            this.logger.error(`Redis auth subscribe failed user=${key}`, err),
          );
      }

      entry.refCount++;
      const capturedEntry = entry;
      const sub = capturedEntry.subject.subscribe(observer);

      return () => {
        sub.unsubscribe();
        capturedEntry.refCount--;
        if (capturedEntry.refCount <= 0) {
          capturedEntry.subject.complete();
          this.channels.delete(key);
          this.subscriber
            .unsubscribe(`auth:${key}`)
            .catch((err: unknown) =>
              this.logger.warn(
                `Redis auth unsubscribe failed user=${key}`,
                err,
              ),
            );
        }
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    for (const [, entry] of this.channels) {
      entry.subject.complete();
    }
    this.channels.clear();
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}
