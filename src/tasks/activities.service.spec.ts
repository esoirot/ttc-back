import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { TaskActivityRepository } from './repositories/task-activity.repository';

describe('ActivitiesService (tasks)', () => {
  let service: ActivitiesService;
  let repo: {
    findByTask: jest.Mock;
    findByTimeEntry: jest.Mock;
    log: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findByTask: jest.fn(),
      findByTimeEntry: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: TaskActivityRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(ActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findByTask — delegates to repo', async () => {
    const activities = [{ id: 1, taskId: 1, type: 'CREATED' }];
    repo.findByTask.mockResolvedValue(activities);

    const result = await service.findByTask(1);

    expect(repo.findByTask).toHaveBeenCalledWith(1);
    expect(result).toEqual(activities);
  });

  it('log — delegates to repo with taskId, userId, type, payload', async () => {
    const activity = { id: 2, taskId: 1, userId: 7, type: 'TITLE_CHANGED' };
    repo.log.mockResolvedValue(activity);

    const payload = { from: 'Old', to: 'New' };
    const result = await service.log(1, 7, 'TITLE_CHANGED', payload);

    expect(repo.log).toHaveBeenCalledWith({
      taskId: 1,
      userId: 7,
      type: 'TITLE_CHANGED',
      payload,
    });
    expect(result).toEqual(activity);
  });

  it('log — works without payload', async () => {
    repo.log.mockResolvedValue({
      id: 3,
      taskId: 1,
      userId: 7,
      type: 'CREATED',
    });

    await service.log(1, 7, 'CREATED');

    expect(repo.log).toHaveBeenCalledWith({
      taskId: 1,
      userId: 7,
      type: 'CREATED',
      payload: undefined,
    });
  });

  it('findByTimeEntry — delegates to repo', async () => {
    const activities = [{ id: 5, timeEntryId: 3, type: 'STARTED' }];
    repo.findByTimeEntry.mockResolvedValue(activities);

    const result = await service.findByTimeEntry(3);

    expect(repo.findByTimeEntry).toHaveBeenCalledWith(3);
    expect(result).toEqual(activities);
  });

  it('logForTimeEntry — delegates to repo with timeEntryId, userId, type, payload', async () => {
    const activity = { id: 6, timeEntryId: 3, userId: 7, type: 'STOPPED' };
    repo.log.mockResolvedValue(activity);

    const payload = { durationSeconds: 3600 };
    const result = await service.logForTimeEntry(3, 7, 'STOPPED', payload);

    expect(repo.log).toHaveBeenCalledWith({
      timeEntryId: 3,
      userId: 7,
      type: 'STOPPED',
      payload,
    });
    expect(result).toEqual(activity);
  });

  it('logForTimeEntry — works without payload', async () => {
    repo.log.mockResolvedValue({
      id: 7,
      timeEntryId: 3,
      userId: 7,
      type: 'RESUMED',
    });

    await service.logForTimeEntry(3, 7, 'RESUMED');

    expect(repo.log).toHaveBeenCalledWith({
      timeEntryId: 3,
      userId: 7,
      type: 'RESUMED',
      payload: undefined,
    });
  });

  it('logForTimeEntry — passes taskId through when the entry is task-linked', async () => {
    repo.log.mockResolvedValue({
      id: 8,
      timeEntryId: 3,
      taskId: 5,
      userId: 7,
      type: 'STARTED',
    });

    await service.logForTimeEntry(3, 7, 'STARTED', undefined, 5);

    expect(repo.log).toHaveBeenCalledWith({
      timeEntryId: 3,
      taskId: 5,
      userId: 7,
      type: 'STARTED',
      payload: undefined,
    });
  });
});
