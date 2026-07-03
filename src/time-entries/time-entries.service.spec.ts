import { Test, TestingModule } from '@nestjs/testing';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntryRepository } from './repositories/time-entry.repository';
import { PrismaService } from '../prisma.service';
import { ActivitiesService } from '../tasks/activities.service';
import { mockTimeEntry } from '../__test-helpers__/mock-factories';

describe('TimeEntriesService', () => {
  let service: TimeEntriesService;
  let repo: {
    findById: jest.Mock;
    findAll: jest.Mock;
    findActive: jest.Mock;
    create: jest.Mock;
    startTimer: jest.Mock;
    stopTimer: jest.Mock;
    update: jest.Mock;
    resumeEntry: jest.Mock;
    delete: jest.Mock;
    existsByClockifyEntryId: jest.Mock;
  };
  let activitiesService: {
    logForTimeEntry: jest.Mock;
    findByTimeEntry: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      create: jest.fn(),
      startTimer: jest.fn(),
      stopTimer: jest.fn(),
      update: jest.fn(),
      resumeEntry: jest.fn(),
      delete: jest.fn(),
      existsByClockifyEntryId: jest.fn(),
    };
    activitiesService = {
      logForTimeEntry: jest.fn().mockResolvedValue(undefined),
      findByTimeEntry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeEntriesService,
        { provide: TimeEntryRepository, useValue: repo },
        {
          provide: PrismaService,
          useValue: { subtask: { findUnique: jest.fn() } },
        },
        { provide: ActivitiesService, useValue: activitiesService },
      ],
    }).compile();

    service = module.get<TimeEntriesService>(TimeEntriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('delegates to repository', async () => {
      const entry = mockTimeEntry();
      repo.create.mockResolvedValue(entry);

      const input = {
        description: 'work',
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T10:00:00Z'),
      };

      const result = await service.create(1, input);
      expect(repo.create).toHaveBeenCalledWith(1, input);
      expect(result).toEqual(entry);
    });
  });

  describe('startTimer', () => {
    it('delegates to repository', async () => {
      const entry = mockTimeEntry({ endTime: null });
      repo.startTimer.mockResolvedValue(entry);

      const result = await service.startTimer(1, { projectId: 2 });
      expect(repo.startTimer).toHaveBeenCalledWith(1, { projectId: 2 });
      expect(result).toEqual(entry);
    });

    it('logs a STARTED activity for the new entry', async () => {
      const entry = mockTimeEntry({
        id: 9,
        endTime: null,
        projectId: 2,
        taskId: null,
        description: 'work',
      });
      repo.startTimer.mockResolvedValue(entry);

      await service.startTimer(1, { projectId: 2 });

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        9,
        1,
        'STARTED',
        { projectId: 2, taskId: null, description: 'work' },
        undefined,
      );
    });

    it('passes the linked taskId so the activity also shows on the task', async () => {
      const entry = mockTimeEntry({
        id: 9,
        endTime: null,
        taskId: 5,
        description: 'work',
      });
      repo.startTimer.mockResolvedValue(entry);

      await service.startTimer(1, { taskId: 5 });

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        9,
        1,
        'STARTED',
        expect.objectContaining({ taskId: 5 }),
        5,
      );
    });
  });

  describe('stopTimer', () => {
    it('delegates to repository', async () => {
      const entry = mockTimeEntry({
        endTime: new Date(),
        durationSeconds: 3600,
      });
      repo.stopTimer.mockResolvedValue(entry);

      const result = await service.stopTimer(1);
      expect(repo.stopTimer).toHaveBeenCalledWith(1);
      expect(result).toEqual(entry);
    });

    it('logs a STOPPED activity with the duration and description', async () => {
      const entry = mockTimeEntry({
        id: 9,
        endTime: new Date(),
        durationSeconds: 3600,
        description: 'translate chapter 3',
      });
      repo.stopTimer.mockResolvedValue(entry);

      await service.stopTimer(1);

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        9,
        1,
        'STOPPED',
        { durationSeconds: 3600, description: 'translate chapter 3' },
        undefined,
      );
    });

    it('passes the linked taskId so the activity also shows on the task', async () => {
      const entry = mockTimeEntry({
        id: 9,
        endTime: new Date(),
        durationSeconds: 3600,
        taskId: 5,
      });
      repo.stopTimer.mockResolvedValue(entry);

      await service.stopTimer(1);

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        9,
        1,
        'STOPPED',
        expect.objectContaining({ durationSeconds: 3600 }),
        5,
      );
    });
  });

  describe('resumeEntry', () => {
    it('delegates to repository', async () => {
      const entry = mockTimeEntry({ id: 9, endTime: null });
      repo.resumeEntry.mockResolvedValue(entry);

      const result = await service.resumeEntry(9, 1);
      expect(repo.resumeEntry).toHaveBeenCalledWith(9, 1);
      expect(result).toEqual(entry);
    });

    it('logs a RESUMED activity', async () => {
      const entry = mockTimeEntry({ id: 9, endTime: null });
      repo.resumeEntry.mockResolvedValue(entry);

      await service.resumeEntry(9, 1);

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        9,
        1,
        'RESUMED',
        undefined,
        undefined,
      );
    });

    it('passes the linked taskId so the activity also shows on the task', async () => {
      const entry = mockTimeEntry({ id: 9, endTime: null, taskId: 5 });
      repo.resumeEntry.mockResolvedValue(entry);

      await service.resumeEntry(9, 1);

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        9,
        1,
        'RESUMED',
        undefined,
        5,
      );
    });
  });

  describe('update', () => {
    it('delegates to repository', async () => {
      const entry = mockTimeEntry({ description: 'updated' });
      repo.update.mockResolvedValue(entry);

      const result = await service.update(1, 1, {
        id: 1,
        description: 'updated',
      });
      expect(repo.update).toHaveBeenCalledWith(1, 1, {
        id: 1,
        description: 'updated',
      });
      expect(result).toEqual(entry);
    });
  });

  describe('delete', () => {
    it('deletes entry and returns true', async () => {
      const entry = mockTimeEntry({ id: 1 });
      repo.findById.mockResolvedValue(entry);
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(1, 1);
      expect(repo.delete).toHaveBeenCalledWith(1, 1);
      expect(result).toBe(true);
    });

    it('logs a DELETED activity with an entry snapshot before deleting', async () => {
      const entry = mockTimeEntry({
        id: 1,
        description: 'work',
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T10:00:00Z'),
        durationSeconds: 3600,
        projectId: 2,
        taskId: null,
        subtaskId: null,
      });
      repo.findById.mockResolvedValue(entry);
      const callOrder: string[] = [];
      activitiesService.logForTimeEntry.mockImplementation(() => {
        callOrder.push('log');
        return Promise.resolve(undefined);
      });
      repo.delete.mockImplementation(() => {
        callOrder.push('delete');
        return Promise.resolve(undefined);
      });

      await service.delete(1, 1);

      expect(repo.findById).toHaveBeenCalledWith(1, 1);
      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        1,
        1,
        'DELETED',
        {
          description: 'work',
          startTime: entry.startTime,
          endTime: entry.endTime,
          durationSeconds: 3600,
          projectId: 2,
          taskId: null,
          subtaskId: null,
        },
        undefined,
      );
      expect(callOrder).toEqual(['log', 'delete']);
    });

    it('passes the linked taskId so the activity also shows on the task', async () => {
      const entry = mockTimeEntry({ id: 1, taskId: 5 });
      repo.findById.mockResolvedValue(entry);
      repo.delete.mockResolvedValue(undefined);

      await service.delete(1, 1);

      expect(activitiesService.logForTimeEntry).toHaveBeenCalledWith(
        1,
        1,
        'DELETED',
        expect.objectContaining({ taskId: 5 }),
        5,
      );
    });
  });

  describe('findActive', () => {
    it('returns active entry when timer running', async () => {
      const entry = mockTimeEntry({ endTime: null });
      repo.findActive.mockResolvedValue(entry);

      const result = await service.findActive(1);
      expect(result).toEqual(entry);
    });

    it('returns null when no active timer', async () => {
      repo.findActive.mockResolvedValue(null);

      const result = await service.findActive(1);
      expect(result).toBeNull();
    });
  });

  describe('importEntries', () => {
    const makeEntry = (id: string, start: string, end: string) => ({
      id,
      description: 'Work',
      start,
      end,
      billable: true,
    });

    it('imports new entries and skips duplicates', async () => {
      repo.existsByClockifyEntryId.mockImplementation((_userId, id: string) =>
        Promise.resolve(id === 'existing'),
      );
      repo.create.mockResolvedValue(mockTimeEntry());

      const result = await service.importEntries(1, [
        makeEntry('existing', '2024-01-01T09:00:00Z', '2024-01-01T10:00:00Z'),
        makeEntry('new-1', '2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z'),
        makeEntry('new-2', '2024-01-01T11:00:00Z', '2024-01-01T12:00:00Z'),
      ]);

      expect(result).toEqual({ imported: 2, skipped: 1 });
      expect(repo.create).toHaveBeenCalledTimes(2);
    });

    it('skips entries with non-positive duration', async () => {
      repo.existsByClockifyEntryId.mockResolvedValue(false);

      const result = await service.importEntries(1, [
        makeEntry('bad', '2024-01-01T10:00:00Z', '2024-01-01T09:00:00Z'),
      ]);

      expect(result).toEqual({ imported: 0, skipped: 1 });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('returns zeros when entries array is empty', async () => {
      const result = await service.importEntries(1, []);
      expect(result).toEqual({ imported: 0, skipped: 0 });
    });

    it('passes correct fields to repo.create', async () => {
      repo.existsByClockifyEntryId.mockResolvedValue(false);
      repo.create.mockResolvedValue(mockTimeEntry());

      await service.importEntries(1, [
        makeEntry('e1', '2024-01-01T09:00:00Z', '2024-01-01T10:30:00Z'),
      ]);

      expect(repo.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          description: 'Work',
          billable: true,
          clockifyEntryId: 'e1',
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T10:30:00Z'),
        }),
      );
    });
  });
});
