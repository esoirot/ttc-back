import { PrismaTaskRepository } from './prisma-task.repository';
import type { PrismaService } from '../../prisma.service';

describe('PrismaTaskRepository wordCount', () => {
  it('stores the word count of a new task', async () => {
    const create = jest
      .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({});
    const repo = new PrismaTaskRepository({
      task: { create },
    } as unknown as PrismaService);

    await repo.create({ projectId: 1, title: 'Chapter 1', wordCount: 500 });

    expect(create.mock.calls[0][0].data).toMatchObject({ wordCount: 500 });
  });
});

describe('PrismaTaskRepository.findByProject search', () => {
  type Where = Record<string, unknown>;
  let findMany: jest.Mock<Promise<unknown[]>, [{ where: Where }]>;
  let count: jest.Mock<Promise<number>, [{ where: Where }]>;
  let repo: PrismaTaskRepository;

  beforeEach(() => {
    findMany = jest
      .fn<Promise<unknown[]>, [{ where: Where }]>()
      .mockResolvedValue([]);
    count = jest.fn<Promise<number>, [{ where: Where }]>().mockResolvedValue(0);
    repo = new PrismaTaskRepository({
      task: { findMany, count },
    } as unknown as PrismaService);
  });

  it('only returns tasks whose title contains the search, ignoring case', async () => {
    await repo.findByProject(1, 7, { limit: 20 }, 'chapter');

    const titleFilter = {
      title: { contains: 'chapter', mode: 'insensitive' },
    };
    expect(findMany.mock.calls[0][0].where).toMatchObject(titleFilter);
    expect(count.mock.calls[0][0].where).toMatchObject(titleFilter);
  });

  it('returns every task of the project without a search', async () => {
    await repo.findByProject(1, 7, { limit: 20 });

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('title');
  });
});
