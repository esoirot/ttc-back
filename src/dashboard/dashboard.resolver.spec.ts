import { Test, TestingModule } from '@nestjs/testing';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardService } from './dashboard.service';

describe('DashboardResolver', () => {
  let resolver: DashboardResolver;
  let service: { getDashboard: jest.Mock };

  const user = { id: 1, role: 'USER' };

  beforeEach(async () => {
    service = { getDashboard: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardResolver,
        { provide: DashboardService, useValue: service },
      ],
    }).compile();

    resolver = module.get<DashboardResolver>(DashboardResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('getDashboard — delegates with user id', async () => {
    const dashboard = {
      activeProjectCount: 2,
      unpaidInvoiceCount: 1,
      monthToDateSeconds: 14400,
      monthToDateRevenue: 600,
      upcomingDeadlines: [],
      recentTimeEntries: [],
      prospectsToContact: [],
    };
    service.getDashboard.mockResolvedValue(dashboard);

    const result = await resolver.getDashboard(user);
    expect(service.getDashboard).toHaveBeenCalledWith(1);
    expect(result).toEqual(dashboard);
  });
});
