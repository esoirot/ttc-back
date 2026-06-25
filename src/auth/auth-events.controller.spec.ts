import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthEventsController } from './auth-events.controller';
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
  });
});
