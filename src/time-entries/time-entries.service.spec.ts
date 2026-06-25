import { Test, TestingModule } from '@nestjs/testing';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntryRepository } from './repositories/time-entry.repository';
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
    delete: jest.Mock;
    existsByClockifyEntryId: jest.Mock;
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
      delete: jest.fn(),
      existsByClockifyEntryId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeEntriesService,
        { provide: TimeEntryRepository, useValue: repo },
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
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(1, 1);
      expect(repo.delete).toHaveBeenCalledWith(1, 1);
      expect(result).toBe(true);
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
