import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoadersService } from './loaders.service';
import { SubtasksService } from '../../tasks/subtasks.service';
import { CommentsService } from '../../tasks/comments.service';
import { LabelsService } from '../../tasks/labels.service';
import { ActivitiesService } from '../../tasks/activities.service';
import { AttachmentsService } from '../../tasks/attachments.service';
import { ClientStatusHistoryService } from '../../clients/client-status-history.service';
import { TimeEntriesService } from '../../time-entries/time-entries.service';

describe('LoadersService', () => {
  let service: LoadersService;
  let subtasksService: { findByTaskIds: jest.Mock };
  let timeEntriesService: {
    getTotalDurationByTaskIds: jest.Mock;
    getTotalDurationByProjectIds: jest.Mock;
  };

  beforeEach(async () => {
    subtasksService = { findByTaskIds: jest.fn().mockResolvedValue([]) };
    timeEntriesService = {
      getTotalDurationByTaskIds: jest.fn().mockResolvedValue(new Map()),
      getTotalDurationByProjectIds: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoadersService,
        { provide: SubtasksService, useValue: subtasksService },
        { provide: CommentsService, useValue: {} },
        { provide: LabelsService, useValue: {} },
        { provide: ActivitiesService, useValue: {} },
        { provide: AttachmentsService, useValue: {} },
        { provide: ClientStatusHistoryService, useValue: {} },
        { provide: TimeEntriesService, useValue: timeEntriesService },
      ],
    }).compile();

    service = module.get(LoadersService);
  });

  it('batches concurrent .load() calls into a single repository call (N+1 fix)', async () => {
    const subtaskA = { id: 1, taskId: 10 };
    const subtaskB = { id: 2, taskId: 20 };
    subtasksService.findByTaskIds.mockResolvedValue([subtaskA, subtaskB]);

    const loaders = service.createLoaders(() => 7);
    const [resultForTask10, resultForTask20] = await Promise.all([
      loaders.subtasksByTask.load(10),
      loaders.subtasksByTask.load(20),
    ]);

    expect(subtasksService.findByTaskIds).toHaveBeenCalledTimes(1);
    expect(subtasksService.findByTaskIds).toHaveBeenCalledWith([10, 20], 7);
    expect(resultForTask10).toEqual([subtaskA]);
    expect(resultForTask20).toEqual([subtaskB]);
  });

  it('groups results back by key and defaults missing keys to []', async () => {
    subtasksService.findByTaskIds.mockResolvedValue([{ id: 1, taskId: 10 }]);

    const loaders = service.createLoaders(() => 7);
    const result = await loaders.subtasksByTask.load(99);

    expect(result).toEqual([]);
  });

  it('reads userId lazily so it reflects auth state at call time, not loader-construction time', async () => {
    let currentUserId: number | undefined = undefined;
    const loaders = service.createLoaders(() => currentUserId);

    currentUserId = 42;
    await loaders.subtasksByTask.load(1);

    expect(subtasksService.findByTaskIds).toHaveBeenCalledWith([1], 42);
  });

  it('throws UnauthorizedException if no user is present when the batch executes', async () => {
    const loaders = service.createLoaders(() => undefined);

    await expect(loaders.subtasksByTask.load(1)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('totalSecondsByProject defaults to null for a project with no logged time', async () => {
    timeEntriesService.getTotalDurationByProjectIds.mockResolvedValue(
      new Map([[1, 3600]]),
    );

    const loaders = service.createLoaders(() => 7);
    const [withTime, withoutTime] = await Promise.all([
      loaders.totalSecondsByProject.load(1),
      loaders.totalSecondsByProject.load(2),
    ]);

    expect(
      timeEntriesService.getTotalDurationByProjectIds,
    ).toHaveBeenCalledTimes(1);
    expect(withTime).toBe(3600);
    expect(withoutTime).toBeNull();
  });
});
