import { PrismaDashboardRepository } from './prisma-dashboard.repository';
import type { PrismaService } from '../../prisma.service';

describe('PrismaDashboardRepository', () => {
  let repo: PrismaDashboardRepository;
  let prisma: {
    project: { count: jest.Mock; findMany: jest.Mock };
    invoice: { count: jest.Mock };
    invoiceItem: { findMany: jest.Mock };
    timeEntry: { findMany: jest.Mock; aggregate: jest.Mock };
    client: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      project: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      invoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
      timeEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { wordsProcessed: null } }),
      },
      client: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repo = new PrismaDashboardRepository(prisma as unknown as PrismaService);
  });

  it('sums wordsProcessed across all of the user projects for the current calendar year', async () => {
    prisma.timeEntry.aggregate.mockResolvedValue({
      _sum: { wordsProcessed: 4321 },
    });

    const result = await repo.getDashboard(1);

    const now = new Date();
    expect(prisma.timeEntry.aggregate).toHaveBeenCalledWith({
      where: {
        userId: 1,
        startTime: {
          gte: new Date(now.getFullYear(), 0, 1),
          lt: new Date(now.getFullYear() + 1, 0, 1),
        },
      },
      _sum: { wordsProcessed: true },
    });
    expect(result.yearToDateWords).toBe(4321);
  });

  it('defaults yearToDateWords to 0 when there is no word data yet', async () => {
    const result = await repo.getDashboard(1);

    expect(result.yearToDateWords).toBe(0);
  });
});
