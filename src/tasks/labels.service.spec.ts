import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { TaskLabelRepository } from './repositories/task-label.repository';
import { TaskRepository } from './repositories/task.repository';

const makeLabel = (overrides = {}) => ({
  id: 1,
  taskId: 1,
  name: 'bug',
  color: null,
  createdAt: new Date(),
  ...overrides,
});

describe('LabelsService', () => {
  let service: LabelsService;
  let repo: { findByTask: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let taskRepo: { findById: jest.Mock };

  beforeEach(async () => {
    repo = { findByTask: jest.fn(), create: jest.fn(), delete: jest.fn() };
    taskRepo = { findById: jest.fn().mockResolvedValue({ id: 1 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelsService,
        { provide: TaskLabelRepository, useValue: repo },
        { provide: TaskRepository, useValue: taskRepo },
      ],
    }).compile();

    service = module.get<LabelsService>(LabelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findByTask — delegates to repository', async () => {
    const labels = [makeLabel()];
    repo.findByTask.mockResolvedValue(labels);

    const result = await service.findByTask(1);
    expect(repo.findByTask).toHaveBeenCalledWith(1);
    expect(result).toEqual(labels);
  });

  describe('create', () => {
    it('checks task ownership then delegates to repository', async () => {
      const label = makeLabel({ name: 'urgent' });
      repo.create.mockResolvedValue(label);

      const result = await service.create({ taskId: 1, name: 'urgent' }, 7);

      expect(taskRepo.findById).toHaveBeenCalledWith(1, 7);
      expect(repo.create).toHaveBeenCalledWith({ taskId: 1, name: 'urgent' });
      expect(result).toEqual(label);
    });

    it('rejects labeling a task the caller cannot access (#19)', async () => {
      taskRepo.findById.mockRejectedValue(
        new NotFoundException('Task 1 not found'),
      );

      await expect(
        service.create({ taskId: 1, name: 'urgent' }, 7),
      ).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('delegates to repository with the caller id and returns true', async () => {
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(1, 7);
      expect(repo.delete).toHaveBeenCalledWith(1, 7);
      expect(result).toBe(true);
    });

    it('rejects deleting a label the caller cannot access (#19)', async () => {
      repo.delete.mockRejectedValue(new NotFoundException('Label 1 not found'));

      await expect(service.delete(1, 7)).rejects.toThrow(NotFoundException);
    });
  });
});
