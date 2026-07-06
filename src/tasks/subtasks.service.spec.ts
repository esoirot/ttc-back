import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubtasksService } from './subtasks.service';
import { SubtaskRepository } from './repositories/subtask.repository';
import { TaskRepository } from './repositories/task.repository';
import { ActivitiesService } from './activities.service';

const makeSubtask = (overrides = {}) => ({
  id: 1,
  taskId: 1,
  title: 'Item',
  checklistTitle: 'Checklist',
  done: false,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SubtasksService', () => {
  let service: SubtasksService;
  let repo: {
    findByTask: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteByChecklist: jest.Mock;
    renameChecklist: jest.Mock;
  };
  let taskRepo: {
    findById: jest.Mock;
    addChecklistTitle: jest.Mock;
    removeChecklistTitle: jest.Mock;
    renameChecklistTitle: jest.Mock;
  };
  let activitiesService: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findByTask: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByChecklist: jest.fn(),
      renameChecklist: jest.fn(),
    };
    taskRepo = {
      findById: jest.fn().mockResolvedValue({ id: 1 }),
      addChecklistTitle: jest.fn(),
      removeChecklistTitle: jest.fn(),
      renameChecklistTitle: jest.fn(),
    };
    activitiesService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtasksService,
        { provide: SubtaskRepository, useValue: repo },
        { provide: TaskRepository, useValue: taskRepo },
        { provide: ActivitiesService, useValue: activitiesService },
      ],
    }).compile();

    service = module.get<SubtasksService>(SubtasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates subtask and logs CHECKLIST_ADDED', async () => {
      const subtask = makeSubtask({ title: 'Task 1' });
      repo.create.mockResolvedValue(subtask);

      const result = await service.create(
        { taskId: 1, title: 'Task 1', checklistTitle: 'Checklist' },
        7,
      );

      expect(taskRepo.findById).toHaveBeenCalledWith(1, 7);
      expect(repo.create).toHaveBeenCalled();
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_ADDED',
        { title: 'Task 1' },
      );
      expect(result).toEqual(subtask);
    });

    it('rejects adding a subtask to a task the caller cannot access (#18)', async () => {
      taskRepo.findById.mockRejectedValue(
        new NotFoundException('Task 1 not found'),
      );

      await expect(
        service.create({ taskId: 1, title: 'Task 1' }, 7),
      ).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('logs CHECKLIST_ITEM_TOGGLED when done state changes', async () => {
      const before = makeSubtask({ done: false });
      const after = makeSubtask({
        done: true,
        taskId: 1,
        title: 'Item',
        checklistTitle: 'Checklist',
      });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, done: true }, 7);

      expect(repo.findById).toHaveBeenCalledWith(1, 7);
      expect(repo.update).toHaveBeenCalledWith(1, 7, { id: 1, done: true });
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_ITEM_TOGGLED',
        {
          title: 'Item',
          checklistTitle: 'Checklist',
          done: true,
        },
      );
    });

    it('logs CHECKLIST_UPDATED when done state unchanged', async () => {
      const before = makeSubtask({ done: true });
      const after = makeSubtask({ done: true, title: 'Updated', taskId: 1 });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, title: 'Updated' }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_UPDATED',
        expect.any(Object),
      );
    });

    it('logs CHECKLIST_UPDATED when done not in input', async () => {
      const before = makeSubtask({ done: false });
      const after = makeSubtask({ done: false, title: 'Renamed', taskId: 1 });
      repo.findById.mockResolvedValue(before);
      repo.update.mockResolvedValue(after);

      await service.update(1, { id: 1, title: 'Renamed' }, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_UPDATED',
        expect.any(Object),
      );
    });

    it('rejects updating a subtask the caller cannot access (#18)', async () => {
      repo.findById.mockRejectedValue(
        new NotFoundException('Subtask 1 not found'),
      );

      await expect(service.update(1, { id: 1, done: true }, 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('createChecklist', () => {
    it('adds checklist title and logs CHECKLIST_CREATED', async () => {
      taskRepo.addChecklistTitle.mockResolvedValue(undefined);

      const result = await service.createChecklist(1, 'My List', 7);

      expect(taskRepo.findById).toHaveBeenCalledWith(1, 7);
      expect(taskRepo.addChecklistTitle).toHaveBeenCalledWith(1, 'My List');
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_CREATED',
        { title: 'My List' },
      );
      expect(result).toBe(true);
    });

    it('rejects creating a checklist on a task the caller cannot access (#18)', async () => {
      taskRepo.findById.mockRejectedValue(
        new NotFoundException('Task 1 not found'),
      );

      await expect(service.createChecklist(1, 'My List', 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(taskRepo.addChecklistTitle).not.toHaveBeenCalled();
    });
  });

  describe('deleteChecklist', () => {
    it('removes items, removes title, logs CHECKLIST_REMOVED', async () => {
      repo.deleteByChecklist.mockResolvedValue(undefined);
      taskRepo.removeChecklistTitle.mockResolvedValue(undefined);

      const result = await service.deleteChecklist(1, 'My List', 7);

      expect(taskRepo.findById).toHaveBeenCalledWith(1, 7);
      expect(repo.deleteByChecklist).toHaveBeenCalledWith(1, 'My List');
      expect(taskRepo.removeChecklistTitle).toHaveBeenCalledWith(1, 'My List');
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_REMOVED',
        { title: 'My List' },
      );
      expect(result).toBe(true);
    });

    it('rejects deleting a checklist on a task the caller cannot access (#18)', async () => {
      taskRepo.findById.mockRejectedValue(
        new NotFoundException('Task 1 not found'),
      );

      await expect(service.deleteChecklist(1, 'My List', 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.deleteByChecklist).not.toHaveBeenCalled();
    });
  });

  describe('renameChecklist', () => {
    it('renames items, renames title, logs CHECKLIST_RENAMED', async () => {
      repo.renameChecklist.mockResolvedValue(undefined);
      taskRepo.renameChecklistTitle.mockResolvedValue(undefined);

      const result = await service.renameChecklist(1, 'Old', 'New', 7);

      expect(taskRepo.findById).toHaveBeenCalledWith(1, 7);
      expect(repo.renameChecklist).toHaveBeenCalledWith(1, 'Old', 'New');
      expect(taskRepo.renameChecklistTitle).toHaveBeenCalledWith(
        1,
        'Old',
        'New',
      );
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_RENAMED',
        { from: 'Old', to: 'New' },
      );
      expect(result).toBe(true);
    });

    it('rejects renaming a checklist on a task the caller cannot access (#18)', async () => {
      taskRepo.findById.mockRejectedValue(
        new NotFoundException('Task 1 not found'),
      );

      await expect(service.renameChecklist(1, 'Old', 'New', 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.renameChecklist).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes subtask and logs CHECKLIST_DELETED', async () => {
      const subtask = makeSubtask({ taskId: 1, title: 'Item' });
      repo.delete.mockResolvedValue(subtask);

      const result = await service.delete(1, 7);

      expect(repo.delete).toHaveBeenCalledWith(1, 7);
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'CHECKLIST_DELETED',
        { title: 'Item' },
      );
      expect(result).toBe(true);
    });

    it('rejects deleting a subtask the caller cannot access (#18)', async () => {
      repo.delete.mockRejectedValue(
        new NotFoundException('Subtask 1 not found'),
      );

      await expect(service.delete(1, 7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByTask', () => {
    it('delegates to repository', async () => {
      repo.findByTask.mockResolvedValue([]);

      const result = await service.findByTask(1);
      expect(repo.findByTask).toHaveBeenCalledWith(1);
      expect(result).toEqual([]);
    });
  });
});
