import type { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';

// Lifecycle of a *gated* channel (mirrors timer-events.service.ts's original
// comment — preserved here since it moved with the code it describes):
//   subscribing → active         (redis.subscribe resolved, clients still present)
//   subscribing → cleaning       (last client left before redis.subscribe resolved)
//   active      → cleaning       (last client left; triggers performCleanup)
//   cleaning    → <deleted>      (redis.unsubscribe resolved; entry removed from map)
// An *ungated* channel (auth events) skips this entirely: message delivery is
// never gated on subscribe-completion, and cleanup runs synchronously on the
// last unsubscribe instead of being deferred — reproducing AuthEventsService's
// simpler (pre-existing, unchanged) behavior exactly.
type ChannelStatus = 'subscribing' | 'active' | 'cleaning';

interface ChannelState<T> {
  readonly subject: Subject<T>;
  refCount: number;
  status: ChannelStatus;
}

interface RealtimeChannelRegistryStats {
  channels: number;
  active_sse_subscriptions: number;
}

interface RealtimeChannelRegistryOptions<T> {
  subscriber: Redis;
  logger: Logger;
  /** e.g. `'timer:'` or `'auth:'` — prefixed to the key for the Redis channel name. */
  redisChannelPrefix: string;
  /**
   * `true` (timer): message delivery waits for the Redis SUBSCRIBE to
   * resolve, and channel teardown is deferred if one is still in flight.
   * `false` (auth): deliver as soon as a listener exists, clean up
   * synchronously on last unsubscribe — the exact pre-extraction behavior of
   * each service, not a new default.
   */
  gated: boolean;
  parseMessage: (raw: string) => T;
  onBadPayload: (key: string) => void;
  onSubscribeFailed: (key: string, err: unknown) => void;
  onUnsubscribeFailed: (key: string, err: unknown) => void;
}

/**
 * Shared Redis-backed, ref-counted pub/sub channel registry, extracted from
 * TimerEventsService/AuthEventsService's near-identical `channels` Map +
 * subscribe/publish/teardown mechanics. Each caller still owns its own Redis
 * client pair (see redis-pubsub.util.ts) and constructs its own registry
 * instance — channel naming, payload parsing, and log wording all stay
 * caller-specific via the options above so neither service's exact current
 * behavior changes, only the shared plumbing underneath it.
 */
export class RealtimeChannelRegistry<T> {
  private readonly channels = new Map<string, ChannelState<T>>();

  constructor(private readonly opts: RealtimeChannelRegistryOptions<T>) {
    this.opts.subscriber.on('message', (channel: string, message: string) => {
      const key = channel.replace(this.opts.redisChannelPrefix, '');
      const state = this.channels.get(key);
      if (!state) return;
      if (this.opts.gated && state.status !== 'active') return;
      try {
        state.subject.next(this.opts.parseMessage(message));
      } catch {
        this.opts.onBadPayload(key);
      }
    });
  }

  get size(): number {
    return this.channels.size;
  }

  getRefCount(key: string): number {
    return this.channels.get(key)?.refCount ?? 0;
  }

  getStats(): RealtimeChannelRegistryStats {
    let active_sse_subscriptions = 0;
    for (const state of this.channels.values()) {
      active_sse_subscriptions += state.refCount;
    }
    return { channels: this.channels.size, active_sse_subscriptions };
  }

  subscribe(key: string): Observable<T> {
    return new Observable<T>((observer) => {
      let state = this.channels.get(key);

      if (!state || (this.opts.gated && state.status === 'cleaning')) {
        // No channel, or (gated only) previous one is tearing down — create
        // fresh. If 'cleaning': ioredis queues UNSUBSCRIBE then SUBSCRIBE in
        // order (net: subscribed).
        state = {
          subject: new Subject<T>(),
          refCount: 0,
          status: 'subscribing',
        };
        this.channels.set(key, state);
        this.redisSubscribe(key, state);
      }

      state.refCount++;
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
        if (current.refCount <= 0) {
          this.initiateCleanup(key, current);
        }
      };
    });
  }

  private redisSubscribe(key: string, state: ChannelState<T>): void {
    this.opts.subscriber
      .subscribe(this.opts.redisChannelPrefix + key)
      .then(() => {
        if (!this.opts.gated) {
          state.status = 'active';
          return;
        }
        if (this.channels.get(key) !== state) return; // superseded
        if (state.status === 'cleaning') {
          // Last client left while subscribe was in-flight — finish cleanup now.
          this.performCleanup(key, state);
        } else {
          state.status = 'active';
        }
      })
      .catch((err: unknown) => {
        if (!this.opts.gated) {
          // Matches AuthEventsService's original behavior: log only, leave
          // the channel registered (pre-existing behavior, not changed here).
          this.opts.onSubscribeFailed(key, err);
          return;
        }
        if (this.channels.get(key) !== state) return; // superseded
        this.opts.onSubscribeFailed(key, err);
        state.subject.error(
          new Error(`Redis subscribe failed: ${String(err)}`),
        );
        this.channels.delete(key);
      });
  }

  private initiateCleanup(key: string, state: ChannelState<T>): void {
    if (!this.opts.gated) {
      this.performCleanup(key, state);
      return;
    }
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

  private performCleanup(key: string, state: ChannelState<T>): void {
    if (this.opts.gated) {
      if (state.status === 'cleaning' && !this.channels.has(key)) return;
      state.status = 'cleaning';
    }

    state.subject.complete();
    this.channels.delete(key);

    this.opts.subscriber
      .unsubscribe(this.opts.redisChannelPrefix + key)
      .catch((err: unknown) => this.opts.onUnsubscribeFailed(key, err));
  }

  destroy(): void {
    for (const [, state] of this.channels) {
      state.subject.complete();
    }
    this.channels.clear();
  }
}
