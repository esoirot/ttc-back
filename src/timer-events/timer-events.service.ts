import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import type { TimeEntry } from '../time-entries/entities/time-entry.entity';

// Lifecycle of a Redis channel subscription:
//   subscribing → active         (redis.subscribe resolved, clients still present)
//   subscribing → cleaning       (last client left before redis.subscribe resolved)
//   active      → cleaning       (last client left; triggers performCleanup)
//   cleaning    → <deleted>      (redis.unsubscribe resolved; entry removed from map)
//
// Note: Subject, not BehaviorSubject — initial timer state comes from GraphQL activeTimer
// query; SSE only carries updates. No replay/latest-value semantics needed here.
//
// Scalability: one Redis SUBSCRIBE channel per active user. ioredis multiplexes all
// subscriptions on a single TCP connection. Fine at thousands of concurrent users.
// At ~100k+ consider PSUBSCRIBE timer:* with per-message userId filtering instead.
type ChannelStatus = 'subscribing' | 'active' | 'cleaning';

interface ChannelState {
  readonly subject: Subject<TimeEntry | null>;
  refCount: number;
  status: ChannelStatus;
}

export interface TimerEventsStats {
  channels: number;
  active_sse_subscriptions: number;
}

const MAX_SSE_PER_USER = 5;

const REDIS_OPTIONS: RedisOptions = {
  autoResubscribe: true,
  enableReadyCheck: true,
  // Back off up to 5s between reconnect attempts.
  retryStrategy: (times: number) => Math.min(times * 200, 5_000),
};

@Injectable()
export class TimerEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimerEventsService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly channels = new Map<string, ChannelState>();

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
      const key = channel.replace('timer:', '');
      const state = this.channels.get(key);
      if (!state || state.status !== 'active') return;
      try {
        state.subject.next(
          message === 'null' ? null : (JSON.parse(message) as TimeEntry),
        );
      } catch {
        this.logger.warn(`Bad timer payload user=${key}`);
      }
    });

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
        `Redis subscriber ready (active channels: ${this.channels.size})`,
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
      await this.publisher.publish(`timer:${userId}`, payload);
    } catch (err) {
      this.logger.error('Publish failed', err);
    }
  }

  subscribe(userId: number): Observable<TimeEntry | null> {
    const key = String(userId);

    return new Observable<TimeEntry | null>((observer) => {
      let state = this.channels.get(key);

      if (!state || state.status === 'cleaning') {
        // No channel or previous one is tearing down — create fresh.
        // If 'cleaning': ioredis queues UNSUBSCRIBE then SUBSCRIBE in order (net: subscribed).
        state = {
          subject: new Subject<TimeEntry | null>(),
          refCount: 0,
          status: 'subscribing',
        };

        this.channels.set(key, state);
        this.redisSubscribe(key, state);
      }

      if (state.refCount >= MAX_SSE_PER_USER) {
        throw new HttpException(
          'SSE connection limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      state.refCount++;
      this.logger.debug(`SSE connect user=${key} refs=${state.refCount}`);

      const sub = state.subject.subscribe(observer);
      const capturedState = state;

      return () => {
        sub.unsubscribe();

        const current = this.channels.get(key);
        if (!current || current.subject !== capturedState.subject) {
          // Teardown belongs to a superseded channel — already cleaned up.
          return;
        }

        current.refCount--;
        this.logger.debug(
          `SSE disconnect user=${key} refs=${current.refCount}`,
        );

        if (current.refCount <= 0) {
          this.initiateCleanup(key, current);
        }
      };
    });
  }

  getStats(): TimerEventsStats {
    let active_sse_subscriptions = 0;
    for (const state of this.channels.values()) {
      active_sse_subscriptions += state.refCount;
    }
    return { channels: this.channels.size, active_sse_subscriptions };
  }

  private redisSubscribe(key: string, state: ChannelState): void {
    this.subscriber
      .subscribe(`timer:${key}`)
      .then(() => {
        if (this.channels.get(key) !== state) return; // superseded
        if (state.status === 'cleaning') {
          // Last client left while subscribe was in-flight — finish cleanup now.
          this.performCleanup(key, state);
        } else {
          state.status = 'active';
          this.logger.debug(`Redis subscribed timer:${key}`);
        }
      })
      .catch((err: unknown) => {
        if (this.channels.get(key) !== state) return; // superseded
        this.logger.error(`Redis subscribe failed timer:${key}`, err);
        state.subject.error(
          new Error(`Redis subscribe failed: ${String(err)}`),
        );
        this.channels.delete(key);
      });
  }

  private initiateCleanup(key: string, state: ChannelState): void {
    if (state.status === 'subscribing') {
      // redis.subscribe() still in-flight — mark so .then() triggers cleanup.
      state.status = 'cleaning';
      return;
    }
    if (state.status === 'active') {
      this.performCleanup(key, state);
    }
    // 'cleaning' already in progress — idempotent, do nothing.
  }

  private performCleanup(key: string, state: ChannelState): void {
    if (state.status === 'cleaning' && !this.channels.has(key)) return;

    state.status = 'cleaning';
    state.subject.complete();
    this.channels.delete(key);

    this.subscriber
      .unsubscribe(`timer:${key}`)
      .then(() => this.logger.debug(`Redis unsubscribed timer:${key}`))
      .catch((err: unknown) =>
        this.logger.warn(`Redis unsubscribe failed timer:${key}`, err),
      );
  }

  async onModuleDestroy(): Promise<void> {
    for (const [key, state] of this.channels) {
      state.subject.complete();
      this.logger.debug(`Shutdown: closed channel user=${key}`);
    }
    this.channels.clear();
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}
