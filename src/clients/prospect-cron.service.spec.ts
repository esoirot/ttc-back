import { Test, TestingModule } from '@nestjs/testing';
import { ProspectCronService } from './prospect-cron.service';
import { ClientRepository } from './repositories/client.repository';
import { ClientStatusHistoryService } from './client-status-history.service';

describe('ProspectCronService', () => {
  let service: ProspectCronService;
  let clientRepository: {
    findStaleFollowUpClientIds: jest.Mock<
      Promise<{ id: number; userId: number }[]>,
      [Date]
    >;
    promoteClients: jest.Mock<Promise<number>, [number[]]>;
  };
  let statusHistory: { logMany: jest.Mock };

  beforeEach(async () => {
    clientRepository = {
      findStaleFollowUpClientIds: jest
        .fn<Promise<{ id: number; userId: number }[]>, [Date]>()
        .mockResolvedValue([]),
      promoteClients: jest
        .fn<Promise<number>, [number[]]>()
        .mockResolvedValue(0),
    };
    statusHistory = { logMany: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProspectCronService,
        { provide: ClientRepository, useValue: clientRepository },
        { provide: ClientStatusHistoryService, useValue: statusHistory },
      ],
    }).compile();

    service = module.get<ProspectCronService>(ProspectCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('promoteStaleFollowUps', () => {
    it('promotes FOLLOW_UP_3 clients with contactedAt older than 21 days', async () => {
      clientRepository.findStaleFollowUpClientIds.mockResolvedValue([
        { id: 1, userId: 10 },
        { id: 2, userId: 20 },
      ]);
      clientRepository.promoteClients.mockResolvedValue(2);

      await service.promoteStaleFollowUps();

      expect(clientRepository.findStaleFollowUpClientIds).toHaveBeenCalledWith(
        expect.any(Date),
      );
      expect(clientRepository.promoteClients).toHaveBeenCalledWith([1, 2]);
    });

    it("writes a STATUS_CHANGED history row per promoted client, attributed to each client's own userId", async () => {
      clientRepository.findStaleFollowUpClientIds.mockResolvedValue([
        { id: 1, userId: 10 },
        { id: 2, userId: 20 },
      ]);
      clientRepository.promoteClients.mockResolvedValue(2);

      await service.promoteStaleFollowUps();

      expect(statusHistory.logMany).toHaveBeenCalledWith([
        {
          clientId: 1,
          userId: 10,
          type: 'STATUS_CHANGED',
          payload: { from: 'FOLLOW_UP_3', to: 'RECONTACT_LATER' },
        },
        {
          clientId: 2,
          userId: 20,
          type: 'STATUS_CHANGED',
          payload: { from: 'FOLLOW_UP_3', to: 'RECONTACT_LATER' },
        },
      ]);
    });

    it('does not call promoteClients or logMany when no stale clients are found', async () => {
      clientRepository.findStaleFollowUpClientIds.mockResolvedValue([]);

      await service.promoteStaleFollowUps();

      expect(clientRepository.promoteClients).not.toHaveBeenCalled();
      expect(statusHistory.logMany).not.toHaveBeenCalled();
    });

    it('cutoff date is ~21 days before now', async () => {
      const before = Date.now() - 21 * 86_400_000;
      await service.promoteStaleFollowUps();
      const after = Date.now() - 21 * 86_400_000;

      const [[cutoff]] = clientRepository.findStaleFollowUpClientIds.mock.calls;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after + 1000);
    });

    it('swallows repository errors silently', async () => {
      clientRepository.findStaleFollowUpClientIds.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(service.promoteStaleFollowUps()).resolves.toBeUndefined();
    });

    it('logs count on success', async () => {
      clientRepository.findStaleFollowUpClientIds.mockResolvedValue([
        { id: 1, userId: 10 },
        { id: 2, userId: 20 },
        { id: 3, userId: 30 },
        { id: 4, userId: 40 },
      ]);
      clientRepository.promoteClients.mockResolvedValue(4);
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});

      await service.promoteStaleFollowUps();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('4'));
      logSpy.mockRestore();
    });

    it('logs error on failure', async () => {
      clientRepository.findStaleFollowUpClientIds.mockRejectedValue(
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
