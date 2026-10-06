import { PrismaTimeEntryRepository } from './prisma-time-entry.repository';
import type { PrismaService } from '../../prisma.service';

describe('PrismaTimeEntryRepository.findFirstStartTime', () => {
  let findFirst: jest.Mock<
    Promise<{ startTime: Date } | null>,
    [Record<string, unknown>]
  >;
  let repo: PrismaTimeEntryRepository;

  beforeEach(() => {
    findFirst = jest.fn<
      Promise<{ startTime: Date } | null>,
      [Record<string, unknown>]
    >();
    repo = new PrismaTimeEntryRepository({
      timeEntry: { findFirst },
    } as unknown as PrismaService);
  });

  it("returns the start of the user's oldest entry", async () => {
    const first = new Date('2024-03-04T09:00:00.000Z');
    findFirst.mockResolvedValue({ startTime: first });

    expect(await repo.findFirstStartTime(7)).toEqual(first);
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 7 },
      orderBy: { startTime: 'asc' },
      select: { startTime: true },
    });
  });

  it('returns null when the user has no entries', async () => {
    findFirst.mockResolvedValue(null);

    expect(await repo.findFirstStartTime(7)).toBeNull();
  });

  it('limits the search to one project when a projectId is given', async () => {
    findFirst.mockResolvedValue(null);

    await repo.findFirstStartTime(7, 12);

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 7, projectId: 12 },
      orderBy: { startTime: 'asc' },
      select: { startTime: true },
    });
  });

  it('treats an explicit null projectId as no project filter', async () => {
    findFirst.mockResolvedValue(null);

    await repo.findFirstStartTime(7, null as unknown as number);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 } }),
    );
  });
});

describe('PrismaTimeEntryRepository.sumWordsProcessedByTaskIds', () => {
  it("sums every contributor's words per task the user can access", async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { taskId: 3, _sum: { wordsProcessed: 300 } },
      { taskId: 4, _sum: { wordsProcessed: null } },
      { taskId: null, _sum: { wordsProcessed: 50 } },
    ]);
    const repo = new PrismaTimeEntryRepository({
      timeEntry: { groupBy },
    } as unknown as PrismaService);

    const totals = await repo.sumWordsProcessedByTaskIds([3, 4], 7);

    expect(groupBy).toHaveBeenCalledWith({
      by: ['taskId'],
      where: {
        taskId: { in: [3, 4] },
        task: { OR: [{ project: { userId: 7 } }, { assigneeId: 7 }] },
      },
      _sum: { wordsProcessed: true },
    });
    expect(totals).toEqual(
      new Map([
        [3, 300],
        [4, 0],
      ]),
    );
  });
});
