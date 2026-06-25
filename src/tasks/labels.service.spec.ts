import { Test, TestingModule } from '@nestjs/testing';
import { LabelsService } from './labels.service';
import { TaskLabelRepository } from './repositories/task-label.repository';

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

  beforeEach(async () => {
    repo = { findByTask: jest.fn(), create: jest.fn(), delete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelsService,
        { provide: TaskLabelRepository, useValue: repo },
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

  it('create — delegates to repository', async () => {
    const label = makeLabel({ name: 'urgent' });
    repo.create.mockResolvedValue(label);

    const result = await service.create({ taskId: 1, name: 'urgent' });
    expect(repo.create).toHaveBeenCalledWith({ taskId: 1, name: 'urgent' });
    expect(result).toEqual(label);
  });

  it('delete — delegates and returns true', async () => {
    repo.delete.mockResolvedValue(undefined);

    const result = await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });
});
