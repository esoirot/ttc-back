import { Test, TestingModule } from '@nestjs/testing';
import { TimeEntriesResolver } from './time-entries.resolver';
import { TimeEntriesService } from './time-entries.service';
import { TimerEventsService } from '../timer-events/timer-events.service';
import { mockTimeEntry } from '../__test-helpers__/mock-factories';

describe('TimeEntriesResolver', () => {
  let resolver: TimeEntriesResolver;
  let service: {
    findAll: jest.Mock;
    findActive: jest.Mock;
    create: jest.Mock;
    startTimer: jest.Mock;
    stopTimer: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let timerEvents: { publish: jest.Mock };

  const user = { id: 1 };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findActive: jest.fn(),
      create: jest.fn(),
      startTimer: jest.fn(),
      stopTimer: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    timerEvents = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeEntriesResolver,
        { provide: TimeEntriesService, useValue: service },
        { provide: TimerEventsService, useValue: timerEvents },
      ],
    }).compile();

    resolver = module.get<TimeEntriesResolver>(TimeEntriesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findAll — delegates with filters', async () => {
    service.findAll.mockResolvedValue({ edges: [] });

    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    await resolver.findAll(user, 2, [2, 3], start, end, { limit: 10 });
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      {
        projectId: 2,
        projectIds: [2, 3],
        start,
        end,
      },
      { limit: 10 },
    );
  });

  it('activeTimer — delegates to service', async () => {
    const entry = mockTimeEntry({ endTime: null });
    service.findActive.mockResolvedValue(entry);

    const result = await resolver.activeTimer(user);
    expect(service.findActive).toHaveBeenCalledWith(1);
    expect(result).toEqual(entry);
  });

  it('createTimeEntry — delegates to service', async () => {
    const entry = mockTimeEntry();
    service.create.mockResolvedValue(entry);

    const input = {
      description: 'work',
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: new Date('2024-01-01T10:00:00Z'),
    };

    const result = await resolver.createTimeEntry(input, user);
    expect(service.create).toHaveBeenCalledWith(1, input);
    expect(result).toEqual(entry);
  });

  describe('startTimer', () => {
    it('starts timer and publishes SSE event', async () => {
      const entry = mockTimeEntry({ endTime: null });
      service.startTimer.mockResolvedValue(entry);

      const result = await resolver.startTimer({ projectId: 2 }, user);

      expect(service.startTimer).toHaveBeenCalledWith(1, { projectId: 2 });
      expect(timerEvents.publish).toHaveBeenCalledWith(1, entry);
      expect(result).toEqual(entry);
    });

    it('returns entry even if SSE publish fails', async () => {
      const entry = mockTimeEntry();
      service.startTimer.mockResolvedValue(entry);
      timerEvents.publish.mockRejectedValue(new Error('SSE down'));

      const result = await resolver.startTimer({}, user);
      expect(result).toEqual(entry);
    });
  });

  describe('stopTimer', () => {
    it('stops timer and publishes null SSE event', async () => {
      const entry = mockTimeEntry({
        endTime: new Date(),
        durationSeconds: 3600,
      });
      service.stopTimer.mockResolvedValue(entry);

      const result = await resolver.stopTimer(user);

      expect(service.stopTimer).toHaveBeenCalledWith(1);
      expect(timerEvents.publish).toHaveBeenCalledWith(1, null);
      expect(result).toEqual(entry);
    });
  });

  it('updateTimeEntry — delegates with id from input', async () => {
    const entry = mockTimeEntry({ description: 'updated' });
    service.update.mockResolvedValue(entry);

    const result = await resolver.updateTimeEntry(
      { id: 1, description: 'updated' },
      user,
    );
    expect(service.update).toHaveBeenCalledWith(1, 1, {
      id: 1,
      description: 'updated',
    });
    expect(result).toEqual(entry);
  });

  it('deleteTimeEntry — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteTimeEntry(1, user);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
