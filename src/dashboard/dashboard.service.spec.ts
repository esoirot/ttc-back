import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './repositories/dashboard.repository';

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: { getDashboard: jest.Mock };

  beforeEach(async () => {
    repo = { getDashboard: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DashboardRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getDashboard delegates to repository', async () => {
    const dashboard = {
      activeProjectCount: 3,
      unpaidInvoiceCount: 1,
      monthToDateSeconds: 28800,
      monthToDateRevenue: 1200,
      upcomingDeadlines: [],
      recentTimeEntries: [],
      prospectsToContact: [],
    };
    repo.getDashboard.mockResolvedValue(dashboard);

    const result = await service.getDashboard(1);
    expect(repo.getDashboard).toHaveBeenCalledWith(1);
    expect(result).toEqual(dashboard);
  });
});
