import { Test, TestingModule } from '@nestjs/testing';
import { TaskTimeResolver } from './task-time.resolver';
import type { GqlContext } from '../auth/types/gql-context.type';

function makeLoaderCtx(load: jest.Mock): GqlContext {
  return { loaders: { totalSecondsByTask: { load } } } as unknown as GqlContext;
}

describe('TaskTimeResolver', () => {
  let resolver: TaskTimeResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskTimeResolver],
    }).compile();

    resolver = module.get<TaskTimeResolver>(TaskTimeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('totalTimeSeconds — delegates to the totalSecondsByTask loader', async () => {
    const load = jest.fn().mockResolvedValue(3600);

    const result = await resolver.totalTimeSeconds(
      { id: 1 },
      makeLoaderCtx(load),
    );

    expect(load).toHaveBeenCalledWith(1);
    expect(result).toBe(3600);
  });

  it('totalTimeSeconds — returns null when the loader resolves null', async () => {
    const load = jest.fn().mockResolvedValue(null);

    const result = await resolver.totalTimeSeconds(
      { id: 2 },
      makeLoaderCtx(load),
    );

    expect(result).toBeNull();
  });
});
