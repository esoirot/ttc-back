import { Test, TestingModule } from '@nestjs/testing';
import { ClientStatusHistoryService } from './client-status-history.service';
import { ClientStatusHistoryRepository } from './repositories/client-status-history.repository';

describe('ClientStatusHistoryService', () => {
  let service: ClientStatusHistoryService;
  let repo: {
    findByClientIds: jest.Mock;
    log: jest.Mock;
    logMany: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findByClientIds: jest.fn(),
      log: jest.fn(),
      logMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientStatusHistoryService,
        { provide: ClientStatusHistoryRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(ClientStatusHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findByClientIds — delegates to repo', async () => {
    const history = [{ id: 1, clientId: 1, type: 'STATUS_CHANGED' }];
    repo.findByClientIds.mockResolvedValue(history);

    const result = await service.findByClientIds([1], 7);

    expect(repo.findByClientIds).toHaveBeenCalledWith([1], 7);
    expect(result).toEqual(history);
  });

  it('log — delegates to repo with clientId, userId, type, payload', async () => {
    const entry = { id: 2, clientId: 1, userId: 7, type: 'STATUS_CHANGED' };
    repo.log.mockResolvedValue(entry);

    const payload = { from: 'TO_CONTACT', to: 'CONTACTED' };
    const result = await service.log(1, 7, 'STATUS_CHANGED', payload);

    expect(repo.log).toHaveBeenCalledWith({
      clientId: 1,
      userId: 7,
      type: 'STATUS_CHANGED',
      payload,
    });
    expect(result).toEqual(entry);
  });

  it('log — works without payload', async () => {
    repo.log.mockResolvedValue({
      id: 3,
      clientId: 1,
      userId: 7,
      type: 'STATUS_CHANGED',
    });

    await service.log(1, 7, 'STATUS_CHANGED');

    expect(repo.log).toHaveBeenCalledWith({
      clientId: 1,
      userId: 7,
      type: 'STATUS_CHANGED',
      payload: undefined,
    });
  });

  it('logMany — delegates to repo', async () => {
    const entries = [
      { clientId: 1, userId: 7, type: 'STATUS_CHANGED', payload: {} },
      { clientId: 2, userId: 8, type: 'STATUS_CHANGED', payload: {} },
    ];
    repo.logMany.mockResolvedValue(2);

    const result = await service.logMany(entries);

    expect(repo.logMany).toHaveBeenCalledWith(entries);
    expect(result).toBe(2);
  });

  it('logMany — works with an empty array', async () => {
    repo.logMany.mockResolvedValue(0);

    const result = await service.logMany([]);

    expect(repo.logMany).toHaveBeenCalledWith([]);
    expect(result).toBe(0);
  });
});
