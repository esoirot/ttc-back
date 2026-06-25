import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { TaskActivityRepository } from './repositories/task-activity.repository';

describe('ActivitiesService (tasks)', () => {
  let service: ActivitiesService;
  let repo: { findByTask: jest.Mock; log: jest.Mock };

  beforeEach(async () => {
    repo = { findByTask: jest.fn(), log: jest.fn() };

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
});
