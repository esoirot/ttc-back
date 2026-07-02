import { Test, TestingModule } from '@nestjs/testing';
import { Subject, throwError } from 'rxjs';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TimerEventsController, HEARTBEAT_MS } from './timer-events.controller';
import { TimerEventsService } from './timer-events.service';
import type { RequestUser } from '../auth/types/gql-context.type';

const makeRaw = () => ({
  writeHead: jest.fn(),
  flushHeaders: jest.fn(),
  write: jest.fn().mockReturnValue(true),
  writable: true,
  on: jest.fn(),
  end: jest.fn(),
});

const makeReply = (raw = makeRaw(), hijack = jest.fn()) => ({
  raw,
  hijack,
  typed: { hijack, raw } as unknown as FastifyReply,
});

const makeReqRaw = () => {
  const listeners: Record<string, (...args: unknown[]) => void> = {};
  return {
    on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
      listeners[event] = fn;
    }),
    _trigger: (event: string, ...args: unknown[]) =>
      listeners[event]?.(...args),
  };
};

const makeReq = (userId = 7, raw: unknown = { on: jest.fn() }) =>
  ({
    user: { id: userId } as RequestUser,
    raw,
  }) as unknown as FastifyRequest & { user: RequestUser };

describe('TimerEventsController', () => {
  let controller: TimerEventsController;
  let service: {
    subscribe: jest.Mock;
    getStats: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      subscribe: jest.fn(),
      getStats: jest
        .fn()
        .mockReturnValue({ channels: 2, active_sse_subscriptions: 5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimerEventsController],
      providers: [{ provide: TimerEventsService, useValue: service }],
    }).compile();

    controller = module.get(TimerEventsController);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('delegates to service and returns stats', () => {
      const result = controller.getStats();
      expect(service.getStats).toHaveBeenCalled();
      expect(result).toEqual({ channels: 2, active_sse_subscriptions: 5 });
    });
  });

  describe('sseEvents', () => {
    it('hijacks reply and writes SSE headers', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());

      const req = makeReq();
      const reply = makeReply();

      controller.sseEvents(req, reply.typed);

      expect(reply.hijack).toHaveBeenCalled();
      expect(reply.raw.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'Content-Type': 'text/event-stream' }),
      );
      expect(reply.raw.write).toHaveBeenCalledWith(
        'data: {"type":"connected"}\n\n',
      );

      subject.complete();
      jest.clearAllTimers();
    });

    it('subscribes to timer events for authenticated user', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());

      const req = makeReq(42);
      const reply = makeReply();

      controller.sseEvents(req, reply.typed);

      expect(service.subscribe).toHaveBeenCalledWith(42);

      subject.complete();
      jest.clearAllTimers();
    });

    it('writes SSE event data when entry emitted', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());

      const req = makeReq();
      const reply = makeReply();

      controller.sseEvents(req, reply.typed);

      const entry = { id: 1, description: 'Work' };
      subject.next(entry);

      expect(reply.raw.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(entry)}\n\n`,
      );

      subject.complete();
      jest.clearAllTimers();
    });

    it('closes connection when subject completes', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());

      const req = makeReq();
      const reply = makeReply();

      controller.sseEvents(req, reply.typed);
      subject.complete();

      expect(reply.raw.end).toHaveBeenCalled();

      jest.clearAllTimers();
    });

    it('closes connection when subject errors', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();

      controller.sseEvents(makeReq(), makeReply(raw).typed);
      subject.error(new Error('boom'));

      expect(raw.end).toHaveBeenCalled();

      jest.clearAllTimers();
    });

    it('closes when write returns false (backpressure)', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      raw.write.mockReturnValue(false);

      controller.sseEvents(makeReq(), makeReply(raw).typed);
      subject.next({ id: 1 });

      expect(raw.end).toHaveBeenCalled();

      subject.complete();
      jest.clearAllTimers();
    });

    it('skips write when raw not writable', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      raw.writable = false;

      controller.sseEvents(makeReq(), makeReply(raw).typed);
      const writeCallsBefore = raw.write.mock.calls.length;
      subject.next({ id: 1 });

      expect(raw.write.mock.calls.length).toBe(writeCallsBefore);

      subject.complete();
      jest.clearAllTimers();
    });

    it('closes when write throws inside the next handler', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      let calls = 0;
      raw.write.mockImplementation(() => {
        calls++;
        if (calls === 1) return true; // initial "connected" write
        throw new Error('write failed');
      });

      controller.sseEvents(makeReq(), makeReply(raw).typed);
      subject.next({ id: 1 });

      expect(raw.end).toHaveBeenCalled();

      jest.clearAllTimers();
    });

    it('closes on req close event', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const reqRaw = makeReqRaw();

      controller.sseEvents(makeReq(1, reqRaw), makeReply(raw).typed);
      reqRaw._trigger('close');

      expect(raw.end).toHaveBeenCalled();

      jest.clearAllTimers();
    });

    it('closes on req error event', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const reqRaw = makeReqRaw();

      controller.sseEvents(makeReq(1, reqRaw), makeReply(raw).typed);
      reqRaw._trigger('error');

      expect(raw.end).toHaveBeenCalled();

      jest.clearAllTimers();
    });

    it('does not close twice once already closed', () => {
      jest.useFakeTimers();
      const subject = new Subject<any>();
      service.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const reqRaw = makeReqRaw();

      controller.sseEvents(makeReq(1, reqRaw), makeReply(raw).typed);
      subject.complete();
      reqRaw._trigger('close');

      expect(raw.end).toHaveBeenCalledTimes(1);

      jest.clearAllTimers();
    });

    it('closes safely when the observable errors synchronously, before the heartbeat timer is set', () => {
      service.subscribe.mockReturnValue(throwError(() => new Error('boom')));
      const raw = makeRaw();

      expect(() =>
        controller.sseEvents(makeReq(), makeReply(raw).typed),
      ).not.toThrow();
      expect(raw.end).toHaveBeenCalled();
    });

    describe('heartbeat', () => {
      it('writes a ping on each heartbeat tick while writable', () => {
        jest.useFakeTimers();
        const subject = new Subject<any>();
        service.subscribe.mockReturnValue(subject.asObservable());
        const raw = makeRaw();

        controller.sseEvents(makeReq(), makeReply(raw).typed);
        jest.advanceTimersByTime(HEARTBEAT_MS);

        expect(raw.write).toHaveBeenCalledWith(': ping\n\n');

        subject.complete();
        jest.clearAllTimers();
      });

      it('closes when raw becomes unwritable before a heartbeat tick', () => {
        jest.useFakeTimers();
        const subject = new Subject<any>();
        service.subscribe.mockReturnValue(subject.asObservable());
        const raw = makeRaw();

        controller.sseEvents(makeReq(), makeReply(raw).typed);
        raw.writable = false;
        jest.advanceTimersByTime(HEARTBEAT_MS);

        expect(raw.end).toHaveBeenCalled();

        jest.clearAllTimers();
      });

      it('closes when the ping write throws', () => {
        jest.useFakeTimers();
        const subject = new Subject<any>();
        service.subscribe.mockReturnValue(subject.asObservable());
        const raw = makeRaw();
        let calls = 0;
        raw.write.mockImplementation(() => {
          calls++;
          if (calls === 1) return true; // initial "connected" write
          throw new Error('ping failed');
        });

        controller.sseEvents(makeReq(), makeReply(raw).typed);
        jest.advanceTimersByTime(HEARTBEAT_MS);

        expect(raw.end).toHaveBeenCalled();

        jest.clearAllTimers();
      });
    });
  });
});
