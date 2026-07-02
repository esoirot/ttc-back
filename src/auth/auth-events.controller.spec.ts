import { Test, TestingModule } from '@nestjs/testing';
import { Subject, throwError } from 'rxjs';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthEventsController, HEARTBEAT_MS } from './auth-events.controller';
import { AuthEventsService } from './auth-events.service';
import type { RequestUser } from './types/gql-context.type';

const makeRaw = () => {
  const listeners: Record<string, (...args: unknown[]) => void> = {};
  return {
    writeHead: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    writable: true,
    on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
      listeners[event] = fn;
    }),
    _trigger: (event: string, ...args: unknown[]) =>
      listeners[event]?.(...args),
  };
};

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

const makeReply = (raw = makeRaw(), hijack = jest.fn()) =>
  ({
    hijack,
    raw,
  }) as unknown as FastifyReply;

const makeReq = (userId = 1, raw: unknown = { on: jest.fn() }) =>
  ({
    user: { id: userId } as RequestUser,
    raw,
  }) as unknown as FastifyRequest & { user: RequestUser };

describe('AuthEventsController', () => {
  let controller: AuthEventsController;
  let eventsService: { subscribe: jest.Mock };

  beforeEach(async () => {
    eventsService = { subscribe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthEventsController],
      providers: [{ provide: AuthEventsService, useValue: eventsService }],
    }).compile();

    controller = module.get<AuthEventsController>(AuthEventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sseEvents', () => {
    it('hijacks reply and writes SSE headers', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const hijack = jest.fn();
      const reply = makeReply(raw, hijack);
      const req = makeReq(7);

      controller.sseEvents(req, reply);

      expect(hijack).toHaveBeenCalled();
      expect(raw.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'Content-Type': 'text/event-stream' }),
      );
      expect(raw.flushHeaders).toHaveBeenCalled();
    });

    it('writes connected event immediately', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();

      controller.sseEvents(makeReq(), makeReply(raw));

      expect(raw.write).toHaveBeenCalledWith('data: {"type":"connected"}\n\n');
    });

    it('subscribes to authEventsService with user id', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());

      controller.sseEvents(makeReq(42), makeReply());

      expect(eventsService.subscribe).toHaveBeenCalledWith(42);
    });

    it('writes event data when observable emits', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();

      controller.sseEvents(makeReq(), makeReply(raw));
      subject.next({ type: 'session_revoked' });

      expect(raw.write).toHaveBeenCalledWith(
        'data: {"type":"session_revoked"}\n\n',
      );
    });

    it('calls end when observable completes', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();

      controller.sseEvents(makeReq(), makeReply(raw));
      subject.complete();

      expect(raw.end).toHaveBeenCalled();
    });

    it('calls end when observable errors', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();

      controller.sseEvents(makeReq(), makeReply(raw));
      subject.error(new Error('boom'));

      expect(raw.end).toHaveBeenCalled();
    });

    it('closes when write returns false (backpressure)', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      raw.write.mockReturnValue(false);

      controller.sseEvents(makeReq(), makeReply(raw));
      subject.next({ type: 'session_revoked' });

      expect(raw.end).toHaveBeenCalled();
    });

    it('closes on req close event', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const reqRaw = {
        on: jest.fn((event: string, fn: () => void) => {
          if (event === 'close') fn();
        }),
      };

      controller.sseEvents(makeReq(1, reqRaw), makeReply(raw));

      expect(raw.end).toHaveBeenCalled();
    });

    it('skips write when raw not writable', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      raw.writable = false;

      controller.sseEvents(makeReq(), makeReply(raw));
      const writeCallsBefore = raw.write.mock.calls.length;
      subject.next({ type: 'session_revoked' });

      expect(raw.write.mock.calls.length).toBe(writeCallsBefore);
    });

    it('closes when write throws inside the next handler', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      let calls = 0;
      raw.write.mockImplementation(() => {
        calls++;
        if (calls === 1) return true; // initial "connected" write
        throw new Error('write failed');
      });

      controller.sseEvents(makeReq(), makeReply(raw));
      subject.next({ type: 'session_revoked' });

      expect(raw.end).toHaveBeenCalled();
    });

    it('closes on req error event', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const reqRaw = makeReqRaw();

      controller.sseEvents(makeReq(1, reqRaw), makeReply(raw));
      reqRaw._trigger('error');

      expect(raw.end).toHaveBeenCalled();
    });

    it('does not close twice once already closed', () => {
      const subject = new Subject();
      eventsService.subscribe.mockReturnValue(subject.asObservable());
      const raw = makeRaw();
      const reqRaw = makeReqRaw();

      controller.sseEvents(makeReq(1, reqRaw), makeReply(raw));
      subject.complete();
      reqRaw._trigger('close');

      expect(raw.end).toHaveBeenCalledTimes(1);
    });

    it('closes safely when the observable errors synchronously, before the heartbeat timer is set', () => {
      eventsService.subscribe.mockReturnValue(
        throwError(() => new Error('boom')),
      );
      const raw = makeRaw();

      expect(() =>
        controller.sseEvents(makeReq(), makeReply(raw)),
      ).not.toThrow();
      expect(raw.end).toHaveBeenCalled();
    });

    describe('heartbeat', () => {
      afterEach(() => jest.useRealTimers());

      it('writes a ping on each heartbeat tick while writable', () => {
        jest.useFakeTimers();
        const subject = new Subject();
        eventsService.subscribe.mockReturnValue(subject.asObservable());
        const raw = makeRaw();

        controller.sseEvents(makeReq(), makeReply(raw));
        jest.advanceTimersByTime(HEARTBEAT_MS);

        expect(raw.write).toHaveBeenCalledWith(': ping\n\n');
      });

      it('closes when raw becomes unwritable before a heartbeat tick', () => {
        jest.useFakeTimers();
        const subject = new Subject();
        eventsService.subscribe.mockReturnValue(subject.asObservable());
        const raw = makeRaw();

        controller.sseEvents(makeReq(), makeReply(raw));
        raw.writable = false;
        jest.advanceTimersByTime(HEARTBEAT_MS);

        expect(raw.end).toHaveBeenCalled();
      });

      it('closes when the ping write throws', () => {
        jest.useFakeTimers();
        const subject = new Subject();
        eventsService.subscribe.mockReturnValue(subject.asObservable());
        const raw = makeRaw();
        let calls = 0;
        raw.write.mockImplementation(() => {
          calls++;
          if (calls === 1) return true; // initial "connected" write
          throw new Error('ping failed');
        });

        controller.sseEvents(makeReq(), makeReply(raw));
        jest.advanceTimersByTime(HEARTBEAT_MS);

        expect(raw.end).toHaveBeenCalled();
      });
    });
  });
});
