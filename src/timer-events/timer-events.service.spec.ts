import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { TimerEventsService } from './timer-events.service';
import { mockTimeEntry } from '../__test-helpers__/mock-factories';

jest.mock('ioredis', () => {
  return jest.fn();
});

import Redis, { type RedisOptions } from 'ioredis';
const MockRedis = Redis as unknown as jest.Mock;

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const makeRedisInstance = () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    on: jest.fn((event: string, fn: (...args: unknown[]) => void): void => {
      handlers[event] = fn;
    }),
    _trigger: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
  };
};

describe('TimerEventsService', () => {
  let service: TimerEventsService;
  let publisherMock: ReturnType<typeof makeRedisInstance>;
  let subscriberMock: ReturnType<typeof makeRedisInstance>;

  beforeEach(async () => {
    const instances: ReturnType<typeof makeRedisInstance>[] = [];
    MockRedis.mockImplementation(() => {
      const inst = makeRedisInstance();
      instances.push(inst);
      return inst;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimerEventsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get(TimerEventsService);
    [publisherMock, subscriberMock] = instances;

    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('publishes serialized entry to user channel', async () => {
      const entry = mockTimeEntry({ description: 'Work' });

      await service.publish(7, entry);

      expect(publisherMock.publish).toHaveBeenCalledWith(
        'timer:7',
        JSON.stringify(entry),
      );
    });

    it('publishes null as string "null"', async () => {
      await service.publish(7, null);

      expect(publisherMock.publish).toHaveBeenCalledWith('timer:7', 'null');
    });

    it('does not throw when publisher.publish rejects', async () => {
      publisherMock.publish.mockRejectedValue(new Error('Redis down'));

      await expect(service.publish(7, null)).resolves.not.toThrow();
    });
  });

  describe('subscribe', () => {
    it('returns an Observable', () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);
      const obs = service.subscribe(7);

      expect(obs).toBeDefined();
      expect(typeof obs.subscribe).toBe('function');
    });

    it('routes HttpException through Observable error when SSE limit reached', (done) => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      // Fill 5 slots (MAX_SSE_PER_USER = 5)
      for (let i = 0; i < 5; i++) {
        service.subscribe(42).subscribe({ next: () => {}, error: () => {} });
      }

      // 6th connection → error channel
      service.subscribe(42).subscribe({
        error: (err: unknown) => {
          expect(err).toBeInstanceOf(HttpException);
          done();
        },
      });
    });
  });

  describe('getStats', () => {
    it('returns zero stats when no subscriptions', () => {
      const stats = service.getStats();

      expect(stats).toEqual({ channels: 0, active_sse_subscriptions: 0 });
    });

    it('counts active channels and subscriptions', () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      service.subscribe(1).subscribe({ next: () => {} });
      service.subscribe(2).subscribe({ next: () => {} });
      service.subscribe(2).subscribe({ next: () => {} });

      const stats = service.getStats();

      expect(stats.channels).toBe(2);
      expect(stats.active_sse_subscriptions).toBe(3);
    });
  });

  describe('onModuleInit message handler', () => {
    it('registers message handler on subscriber', () => {
      expect(subscriberMock.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('ignores a message for an unknown channel', () => {
      expect(() =>
        subscriberMock._trigger('message', 'timer:999', '"data"'),
      ).not.toThrow();
    });

    it('dispatches parsed entry to an active channel subject', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const received: unknown[] = [];
      service.subscribe(99).subscribe({ next: (v) => received.push(v) });
      await flushPromises(); // let redisSubscribe's .then() flip status to 'active'

      const entry = mockTimeEntry({ description: 'Work' });
      subscriberMock._trigger('message', 'timer:99', JSON.stringify(entry));

      // Dispatch delivers the JSON-parsed payload — Dates round-trip as strings.
      expect(received).toEqual([JSON.parse(JSON.stringify(entry))]);
    });

    it('dispatches null for the literal string "null"', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const received: unknown[] = [];
      service.subscribe(99).subscribe({ next: (v) => received.push(v) });
      await flushPromises();

      subscriberMock._trigger('message', 'timer:99', 'null');

      expect(received).toEqual([null]);
    });

    it('does not dispatch to a channel that is still subscribing (not yet active)', () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const received: unknown[] = [];
      service.subscribe(99).subscribe({ next: (v) => received.push(v) });
      // No flush — status is still 'subscribing', not 'active'.

      subscriberMock._trigger(
        'message',
        'timer:99',
        JSON.stringify(mockTimeEntry()),
      );

      expect(received).toEqual([]);
    });

    it('logs and does not throw on malformed JSON payload for an active channel', async () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      subscriberMock.subscribe.mockResolvedValue(undefined);

      service.subscribe(99).subscribe({ next: () => {} });
      await flushPromises();

      expect(() =>
        subscriberMock._trigger('message', 'timer:99', 'not-json'),
      ).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith('Bad timer payload user=99');
      warnSpy.mockRestore();
    });
  });

  describe('onModuleInit Redis connection event handlers', () => {
    it('logs subscriber connection errors', () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      subscriberMock._trigger('error', new Error('down'));

      expect(errorSpy).toHaveBeenCalledWith(
        'Redis subscriber error',
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });

    it('logs subscriber reconnecting', () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      subscriberMock._trigger('reconnecting');

      expect(warnSpy).toHaveBeenCalledWith('Redis subscriber reconnecting');
      warnSpy.mockRestore();
    });

    it('logs active channel count when subscriber becomes ready', () => {
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      subscriberMock._trigger('ready');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Redis subscriber ready'),
      );
      logSpy.mockRestore();
    });

    it('logs publisher connection errors', () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      publisherMock._trigger('error', new Error('down'));

      expect(errorSpy).toHaveBeenCalledWith(
        'Redis publisher error',
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });

    it('logs publisher reconnecting', () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      publisherMock._trigger('reconnecting');

      expect(warnSpy).toHaveBeenCalledWith('Redis publisher reconnecting');
      warnSpy.mockRestore();
    });
  });

  describe('Redis retry strategy', () => {
    it('backs off linearly and caps at 5000ms', () => {
      const calls = MockRedis.mock.calls as [string, RedisOptions][];
      const options = calls[0][1];
      const retryStrategy = options.retryStrategy as (times: number) => number;

      expect(retryStrategy(1)).toBe(200);
      expect(retryStrategy(10)).toBe(2000);
      expect(retryStrategy(100)).toBe(5000);
    });
  });

  describe('channel teardown', () => {
    it('does not trigger cleanup while other subscribers remain on the channel', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const subA = service.subscribe(20).subscribe({ next: () => {} });
      service.subscribe(20).subscribe({ next: () => {} });
      await flushPromises();

      subA.unsubscribe();

      expect(subscriberMock.unsubscribe).not.toHaveBeenCalled();
      expect(service.getStats().active_sse_subscriptions).toBe(1);
    });

    it('unsubscribes from Redis once the last subscriber on an active channel leaves', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const sub = service.subscribe(21).subscribe({ next: () => {} });
      await flushPromises();

      sub.unsubscribe();

      expect(subscriberMock.unsubscribe).toHaveBeenCalledWith('timer:21');
      expect(service.getStats().channels).toBe(0);
    });

    it('defers cleanup until the in-flight Redis subscribe resolves, then finishes it', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const sub = service.subscribe(22).subscribe({ next: () => {} });
      sub.unsubscribe(); // last subscriber leaves before redis.subscribe() has resolved

      // Cleanup can't run yet — redisSubscribe's .then() hasn't fired.
      expect(subscriberMock.unsubscribe).not.toHaveBeenCalled();

      await flushPromises(); // .then() sees status === 'cleaning' and finishes cleanup

      expect(subscriberMock.unsubscribe).toHaveBeenCalledWith('timer:22');
      expect(service.getStats().channels).toBe(0);
    });

    it('ignores a superseded in-flight subscribe once a fresh channel has replaced it', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);

      const sub = service.subscribe(23).subscribe({ next: () => {} });
      sub.unsubscribe(); // marks generation 1 'cleaning' before its subscribe resolves

      const received: unknown[] = [];
      service.subscribe(23).subscribe({ next: (v) => received.push(v) }); // generation 2

      await flushPromises(); // both .then() callbacks run; gen 1 finds itself superseded

      expect(subscriberMock.subscribe).toHaveBeenCalledTimes(2);
      // Gen 1's redisSubscribe sees it's been replaced and bails before
      // performCleanup — no redundant UNSUBSCRIBE for a channel gen 2 still needs.
      expect(subscriberMock.unsubscribe).not.toHaveBeenCalled();
      expect(received).toEqual([]);
    });

    it('logs and errors the subject out when the initial Redis subscribe rejects', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      subscriberMock.subscribe.mockRejectedValue(new Error('subscribe down'));

      let observedError: unknown;
      service.subscribe(24).subscribe({
        next: () => {},
        error: (err) => {
          observedError = err;
        },
      });
      await flushPromises();

      expect(observedError).toBeInstanceOf(Error);
      expect(errorSpy).toHaveBeenCalledWith(
        'Redis subscribe failed timer:24',
        expect.any(Error),
      );
      expect(service.getStats().channels).toBe(0);
      errorSpy.mockRestore();
    });

    it('logs and does not throw when the teardown unsubscribe rejects', async () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      subscriberMock.subscribe.mockResolvedValue(undefined);
      subscriberMock.unsubscribe.mockRejectedValue(new Error('unsub down'));

      const sub = service.subscribe(25).subscribe({ next: () => {} });
      await flushPromises();

      sub.unsubscribe();
      await flushPromises();

      expect(warnSpy).toHaveBeenCalledWith(
        'Redis unsubscribe failed timer:25',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls quit on both redis connections', async () => {
      await service.onModuleDestroy();

      expect(publisherMock.quit).toHaveBeenCalled();
      expect(subscriberMock.quit).toHaveBeenCalled();
    });

    it('clears all channel state', async () => {
      subscriberMock.subscribe.mockResolvedValue(undefined);
      service.subscribe(1).subscribe({ next: () => {} });

      await service.onModuleDestroy();

      const stats = service.getStats();
      expect(stats.channels).toBe(0);
    });
  });
});
