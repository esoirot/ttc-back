import { Test, TestingModule } from '@nestjs/testing';
import { ProspectCronService } from './prospect-cron.service';
import { PrismaService } from '../prisma.service';

type UpdateManyArgs = {
  where: { status: string; contactedAt: { lt: Date } };
  data: { status: string };
};

describe('ProspectCronService', () => {
  let service: ProspectCronService;
  let prisma: {
    client: {
      updateMany: jest.Mock<Promise<{ count: number }>, [UpdateManyArgs]>;
    };
  };

  beforeEach(async () => {
    prisma = {
      client: {
        updateMany: jest
          .fn<Promise<{ count: number }>, [UpdateManyArgs]>()
          .mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProspectCronService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProspectCronService>(ProspectCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('promoteStaleFollowUps', () => {
    it('promotes FOLLOW_UP_3 clients with contactedAt older than 21 days', async () => {
      prisma.client.updateMany.mockResolvedValue({ count: 2 });

      await service.promoteStaleFollowUps();

      const anyDate = expect.any(Date) as unknown as Date;
      expect(prisma.client.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'FOLLOW_UP_3',
          contactedAt: { lt: anyDate },
        },
        data: { status: 'RECONTACT_LATER' },
      });
    });

    it('cutoff date is ~21 days before now', async () => {
      const before = Date.now() - 21 * 86_400_000;
      await service.promoteStaleFollowUps();
      const after = Date.now() - 21 * 86_400_000;

      const [[call]] = prisma.client.updateMany.mock.calls;
      const cutoff: Date = call.where.contactedAt.lt;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after + 1000);
    });

    it('swallows prisma errors silently', async () => {
      prisma.client.updateMany.mockRejectedValue(new Error('DB down'));

      await expect(service.promoteStaleFollowUps()).resolves.toBeUndefined();
    });

    it('logs count on success', async () => {
      prisma.client.updateMany.mockResolvedValue({ count: 4 });
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});

      await service.promoteStaleFollowUps();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('4'));
      logSpy.mockRestore();
    });

    it('logs error on failure', async () => {
      prisma.client.updateMany.mockRejectedValue(new Error('timeout'));
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      await service.promoteStaleFollowUps();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('RECONTACT_LATER'),
        expect.stringContaining('timeout'),
      );
      errorSpy.mockRestore();
    });
  });
});
