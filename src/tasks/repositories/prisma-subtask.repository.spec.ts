import { PrismaSubtaskRepository } from './prisma-subtask.repository';
import type { PrismaService } from '../../prisma.service';

describe('PrismaSubtaskRepository wordCount', () => {
  let create: jest.Mock<Promise<unknown>, [{ data: Record<string, unknown> }]>;
  let update: jest.Mock<Promise<unknown>, [{ data: Record<string, unknown> }]>;
  let repo: PrismaSubtaskRepository;

  beforeEach(() => {
    create = jest
      .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({});
    update = jest
      .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({});
    repo = new PrismaSubtaskRepository({
      subtask: {
        create,
        update,
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
    } as unknown as PrismaService);
  });

  it('stores the word count of a new item', async () => {
    await repo.create({ taskId: 1, title: 'Item', wordCount: 200 });
    expect(create.mock.calls[0][0].data).toMatchObject({ wordCount: 200 });
  });

  it('updates and clears the word count', async () => {
    await repo.update(1, 7, { id: 1, wordCount: 300 });
    expect(update.mock.calls[0][0].data).toMatchObject({ wordCount: 300 });

    await repo.update(1, 7, { id: 1, wordCount: null });
    expect(update.mock.calls[1][0].data).toMatchObject({ wordCount: null });
  });

  it('leaves the word count alone when it is not part of the update', async () => {
    await repo.update(1, 7, { id: 1, title: 'Renamed' });
    expect(update.mock.calls[0][0].data).not.toHaveProperty('wordCount');
  });
});

describe('PrismaSubtaskRepository.sumWordsByProjectIds', () => {
  it("adds each project's own task words and its checklist item words", async () => {
    const taskGroupBy = jest.fn().mockResolvedValue([
      { projectId: 1, _sum: { wordCount: 500 } },
      { projectId: 2, _sum: { wordCount: null } },
    ]);
    const subtaskFindMany = jest.fn().mockResolvedValue([
      { wordCount: 200, task: { projectId: 1 } },
      { wordCount: 50, task: { projectId: 3 } },
    ]);
    const repo = new PrismaSubtaskRepository({
      task: { groupBy: taskGroupBy },
      subtask: { findMany: subtaskFindMany },
    } as unknown as PrismaService);

    const totals = await repo.sumWordsByProjectIds([1, 2, 3], 7);

    expect(totals.get(1)).toBe(700);
    expect(totals.get(3)).toBe(50);
    expect(totals.has(2)).toBe(false);
    const [taskArgs] = taskGroupBy.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(taskArgs.where).toMatchObject({
      projectId: { in: [1, 2, 3] },
      project: { userId: 7 },
    });
    const [itemArgs] = subtaskFindMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(itemArgs.where).toMatchObject({
      task: { projectId: { in: [1, 2, 3] }, project: { userId: 7 } },
    });
  });
});
