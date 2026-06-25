jest.mock('ioredis', () => jest.fn());

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AuthEventsService } from './auth-events.service';

const MockRedis = Redis as unknown as jest.Mock;

const makeRedisInstance = () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers[event] = fn;
    }),
    _trigger: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
};

describe('AuthEventsService', () => {
  let service: AuthEventsService;
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
        AuthEventsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthEventsService>(AuthEventsService);
    [publisherMock, subscriberMock] = instances;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('registers message, error, reconnecting handlers on subscriber', () => {
      service.onModuleInit();
      expect(subscriberMock.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
      expect(subscriberMock.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(subscriberMock.on).toHaveBeenCalledWith(
        'reconnecting',
        expect.any(Function),
      );
    });
  });

  describe('publish', () => {
    it('publishes event to correct auth channel', async () => {
      await service.publish(42, { type: 'session_revoked' });
      expect(publisherMock.publish).toHaveBeenCalledWith(
        'auth:42',
        JSON.stringify({ type: 'session_revoked' }),
      );
    });

    it('swallows publish errors silently', async () => {
      publisherMock.publish.mockRejectedValue(new Error('Redis down'));
      await expect(
        service.publish(1, { type: 'session_revoked' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('returns Observable', () => {
      const obs$ = service.subscribe(1);
      expect(typeof obs$.subscribe).toBe('function');
    });

    it('calls subscriber.subscribe with correct channel on first subscriber', (done) => {
      const obs$ = service.subscribe(99);
      const sub = obs$.subscribe({ next: () => {} });

      setImmediate(() => {
        expect(subscriberMock.subscribe).toHaveBeenCalledWith('auth:99');
        sub.unsubscribe();
        done();
      });
    });

    it('does not re-subscribe on second subscriber for same userId', (done) => {
      const sub1 = service.subscribe(5).subscribe({ next: () => {} });
      const sub2 = service.subscribe(5).subscribe({ next: () => {} });

      setImmediate(() => {
        expect(subscriberMock.subscribe).toHaveBeenCalledTimes(1);
        sub1.unsubscribe();
        sub2.unsubscribe();
        done();
      });
    });

    it('delivers message event to subscriber via onModuleInit handler', (done) => {
      service.onModuleInit();

      service.subscribe(7).subscribe({
        next: (event) => {
          expect(event).toEqual({ type: 'session_revoked' });
          done();
        },
      });

      setImmediate(() => {
        subscriberMock._trigger(
          'message',
          'auth:7',
          JSON.stringify({ type: 'session_revoked' }),
        );
      });
    });

    it('ignores message for unknown channel', () => {
      service.onModuleInit();
      expect(() => {
        subscriberMock._trigger(
          'message',
          'auth:999',
          JSON.stringify({ type: 'session_revoked' }),
        );
      }).not.toThrow();
    });

    it('ignores malformed JSON in message handler', (done) => {
      service.onModuleInit();

      service.subscribe(3).subscribe({
        next: () => {
          done.fail('should not emit');
        },
      });

      setImmediate(() => {
        expect(() => {
          subscriberMock._trigger('message', 'auth:3', 'not-json');
        }).not.toThrow();
        done();
      });
    });

    it('calls subscriber.unsubscribe and removes channel when last subscriber leaves', (done) => {
      const sub = service.subscribe(10).subscribe({ next: () => {} });

      setImmediate(() => {
        sub.unsubscribe();
        setImmediate(() => {
          expect(subscriberMock.unsubscribe).toHaveBeenCalledWith('auth:10');
          done();
        });
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('quits both publisher and subscriber', async () => {
      await service.onModuleDestroy();
      expect(publisherMock.quit).toHaveBeenCalled();
      expect(subscriberMock.quit).toHaveBeenCalled();
    });

    it('completes active subjects and clears channels', async () => {
      let completed = false;
      service.subscribe(1).subscribe({
        complete: () => {
          completed = true;
        },
      });

      await service.onModuleDestroy();
      expect(completed).toBe(true);
    });
  });
});
