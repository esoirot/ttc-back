import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TimerEventsController } from './timer-events.controller';
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

const makeReq = (userId = 7) =>
  ({
    user: { id: userId } as RequestUser,
    raw: { on: jest.fn() },
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
  });
});
