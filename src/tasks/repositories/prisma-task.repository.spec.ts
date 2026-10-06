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
