import { Test, TestingModule } from '@nestjs/testing';
import { ClientRatesService } from './client-rates.service';
import { ClientRateRepository } from './repositories/client-rate.repository';
import { mockClientRate } from '../__test-helpers__/mock-factories';

describe('ClientRatesService', () => {
  let service: ClientRatesService;
  let repo: {
    findByClient: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findByClient: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientRatesService,
        { provide: ClientRateRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<ClientRatesService>(ClientRatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findByClient delegates to repository', async () => {
    const rates = [mockClientRate()];
    repo.findByClient.mockResolvedValue(rates);

    const result = await service.findByClient(1, 2);
    expect(repo.findByClient).toHaveBeenCalledWith(1, 2);
    expect(result).toEqual(rates);
  });

  it('findOne delegates to repository', async () => {
    const rate = mockClientRate();
    repo.findById.mockResolvedValue(rate);

    const result = await service.findOne(1, 1);
    expect(result).toEqual(rate);
  });

  it('create delegates to repository', async () => {
    const rate = mockClientRate();
    repo.create.mockResolvedValue(rate);

    const result = await service.create(1, {
      clientId: 1,
      name: 'Rate',
      amount: 0.12,
      type: 'PER_WORD',
      currency: 'EUR',
    });
    expect(repo.create).toHaveBeenCalledWith(1, expect.any(Object));
    expect(result).toEqual(rate);
  });

  it('update delegates to repository', async () => {
    const rate = mockClientRate({ amount: 0.15 });
    repo.update.mockResolvedValue(rate);

    const result = await service.update(1, 1, { id: 1, amount: 0.15 });
    expect(result).toEqual(rate);
  });

  it('delete returns true', async () => {
    repo.delete.mockResolvedValue(undefined);

    const result = await service.delete(1, 1);
    expect(repo.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
