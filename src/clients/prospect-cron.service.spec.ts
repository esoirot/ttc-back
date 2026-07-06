import { Test, TestingModule } from '@nestjs/testing';
import { ProspectCronService } from './prospect-cron.service';
import { ClientRepository } from './repositories/client.repository';

describe('ProspectCronService', () => {
  let service: ProspectCronService;
  let clientRepository: {
    promoteStaleFollowUps: jest.Mock<Promise<number>, [Date]>;
  };

  beforeEach(async () => {
    clientRepository = {
      promoteStaleFollowUps: jest
        .fn<Promise<number>, [Date]>()
        .mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProspectCronService,
        { provide: ClientRepository, useValue: clientRepository },
      ],
    }).compile();

    service = module.get<ProspectCronService>(ProspectCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('promoteStaleFollowUps', () => {
    it('promotes FOLLOW_UP_3 clients with contactedAt older than 21 days', async () => {
      clientRepository.promoteStaleFollowUps.mockResolvedValue(2);

      await service.promoteStaleFollowUps();

      expect(clientRepository.promoteStaleFollowUps).toHaveBeenCalledWith(
        expect.any(Date),
      );
    });

    it('cutoff date is ~21 days before now', async () => {
      const before = Date.now() - 21 * 86_400_000;
      await service.promoteStaleFollowUps();
      const after = Date.now() - 21 * 86_400_000;

      const [[cutoff]] = clientRepository.promoteStaleFollowUps.mock.calls;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after + 1000);
    });

    it('swallows repository errors silently', async () => {
      clientRepository.promoteStaleFollowUps.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(service.promoteStaleFollowUps()).resolves.toBeUndefined();
    });

    it('logs count on success', async () => {
      clientRepository.promoteStaleFollowUps.mockResolvedValue(4);
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});

      await service.promoteStaleFollowUps();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('4'));
      logSpy.mockRestore();
    });

    it('logs error on failure', async () => {
      clientRepository.promoteStaleFollowUps.mockRejectedValue(
        new Error('timeout'),
      );
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
