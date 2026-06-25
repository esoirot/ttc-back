import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { TaskRepository } from './repositories/task.repository';
import { ActivitiesService } from './activities.service';
import { TaskStatus } from './entities/task.entity';
import { mockTask } from '../__test-helpers__/mock-factories';

describe('TasksService', () => {
  let service: TasksService;
  let repo: {
    findById: jest.Mock;
    findByProject: jest.Mock;
    findByAssignee: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let activitiesService: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findByProject: jest.fn(),
      findByAssignee: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    activitiesService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TaskRepository, useValue: repo },
        { provide: ActivitiesService, useValue: activitiesService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates task and logs CREATED activity', async () => {
      const task = mockTask({ id: 42 });
      repo.create.mockResolvedValue(task);

      const result = await service.create(
        { title: 'New Task', projectId: 1 },
        7,
      );

      expect(repo.create).toHaveBeenCalledWith({
        title: 'New Task',
        projectId: 1,
      });
      expect(activitiesService.log).toHaveBeenCalledWith(42, 7, 'CREATED');
      expect(result).toEqual(task);
    });
  });

  describe('update', () => {
    it('does not log any activity when no tracked fields change', async () => {
      const before = mockTask({
        title: 'Old',
        status: 'TODO',
        description: null,
        dueDate: null,
        assigneeId: null,
      });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(before);

      await service.update(1, { id: 1 }, 7);

      expect(activitiesService.log).not.toHaveBeenCalled();
    });

    it('logs TITLE_CHANGED when title changes', async () => {
      const before = mockTask({ title: 'Old Title' });
      const after = mockTask({ title: 'New Title' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, title: 'New Title' }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'TITLE_CHANGED',
        {
          from: 'Old Title',
          to: 'New Title',
        },
      );
    });

    it('does not log TITLE_CHANGED when title is unchanged', async () => {
      const before = mockTask({ title: 'Same' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(before);

      await service.update(1, { id: 1, title: 'Same' }, 7);

      expect(activitiesService.log).not.toHaveBeenCalled();
    });

    it('logs STATUS_CHANGED when status changes', async () => {
      const before = mockTask({ status: 'TODO' });
      const after = mockTask({ status: 'IN_PROGRESS' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, status: TaskStatus.IN_PROGRESS }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'STATUS_CHANGED',
        {
          from: 'TODO',
          to: 'IN_PROGRESS',
        },
      );
    });

    it('logs DESCRIPTION_CHANGED when description changes', async () => {
      const before = mockTask({ description: '' });
      const after = mockTask({ description: 'Updated desc' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, description: 'Updated desc' }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'DESCRIPTION_CHANGED',
      );
    });

    it('logs DUE_DATE_SET when dueDate changes', async () => {
      const newDate = new Date('2024-06-01');
      const before = mockTask({ dueDate: null });
      const after = mockTask({ dueDate: newDate });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, dueDate: newDate }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(1, 7, 'DUE_DATE_SET', {
        to: newDate,
      });
    });

    it('logs ASSIGNED when assigneeId changes', async () => {
      const before = mockTask({ assigneeId: null });
      const after = mockTask({ assigneeId: 5 });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, assigneeId: 5 }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(1, 7, 'ASSIGNED', {
        to: 5,
      });
    });

    it('logs multiple activities when multiple fields change', async () => {
      const before = mockTask({
        title: 'Old',
        status: 'TODO',
        assigneeId: null,
      });
      const after = mockTask({ title: 'New', status: 'DONE', assigneeId: 3 });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(
        1,
        { id: 1, title: 'New', status: TaskStatus.DONE, assigneeId: 3 },
        7,
      );

      expect(activitiesService.log).toHaveBeenCalledTimes(3);
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'TITLE_CHANGED',
        expect.any(Object),
      );
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'STATUS_CHANGED',
        expect.any(Object),
      );
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'ASSIGNED',
        expect.any(Object),
      );
    });

    it('returns updated task', async () => {
      const before = mockTask();
      const after = mockTask({ title: 'Updated' });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      const result = await service.update(1, { id: 1, title: 'Updated' }, 7);
      expect(result).toEqual(after);
    });
  });

  describe('delete', () => {
    it('deletes task and returns true', async () => {
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(1);

      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('findOne', () => {
    it('delegates to repository', async () => {
      const task = mockTask();
      repo.findById.mockResolvedValue(task);

      const result = await service.findOne(1);
      expect(repo.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(task);
    });
  });

  describe('findByProject', () => {
    it('delegates to repository with pagination', async () => {
      const connection = { edges: [], pageInfo: { hasNextPage: false } };
      repo.findByProject.mockResolvedValue(connection);

      const result = await service.findByProject(1, { limit: 10 });
      expect(repo.findByProject).toHaveBeenCalledWith(1, { limit: 10 });
      expect(result).toEqual(connection);
    });
  });

  describe('findByAssignee', () => {
    it('delegates to repository', async () => {
      const connection = { edges: [], pageInfo: { hasNextPage: false } };
      repo.findByAssignee.mockResolvedValue(connection);

      const result = await service.findByAssignee(5);
      expect(repo.findByAssignee).toHaveBeenCalledWith(5, undefined);
      expect(result).toEqual(connection);
    });
  });
});
