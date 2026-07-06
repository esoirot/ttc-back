import { Test, TestingModule } from '@nestjs/testing';
import { TaskTimeResolver } from './task-time.resolver';
import { TimeEntriesService } from './time-entries.service';

describe('TaskTimeResolver', () => {
  let resolver: TaskTimeResolver;
  let timeEntriesService: { getTotalDuration: jest.Mock };

  beforeEach(async () => {
    timeEntriesService = { getTotalDuration: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskTimeResolver,
        { provide: TimeEntriesService, useValue: timeEntriesService },
      ],
    }).compile();

    resolver = module.get<TaskTimeResolver>(TaskTimeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('totalTimeSeconds — sums durationSeconds for the task', async () => {
    timeEntriesService.getTotalDuration.mockResolvedValue(3600);

    const result = await resolver.totalTimeSeconds({ id: 1 });

    expect(timeEntriesService.getTotalDuration).toHaveBeenCalledWith(1);
    expect(result).toBe(3600);
  });

  it('totalTimeSeconds — returns null when the task has no time entries', async () => {
    timeEntriesService.getTotalDuration.mockResolvedValue(null);

    const result = await resolver.totalTimeSeconds({ id: 2 });

    expect(result).toBeNull();
  });
});
