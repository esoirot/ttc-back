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
});
