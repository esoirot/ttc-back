import { Test, TestingModule } from '@nestjs/testing';
import { TranslationRatesService } from './translation-rates.service';
import { TranslationRateRepository } from './repositories/translation-rate.repository';
import { TranslationRateType } from './entities/translation-rate.entity';
import { mockTranslationRate } from '../__test-helpers__/mock-factories';

describe('TranslationRatesService', () => {
  let service: TranslationRatesService;
  let repo: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationRatesService,
        { provide: TranslationRateRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<TranslationRatesService>(TranslationRatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll delegates to repository with filters', async () => {
    const rates = [mockTranslationRate()];
    repo.findAll.mockResolvedValue(rates);

    const result = await service.findAll(1, 'PER_WORD', 2);
    expect(repo.findAll).toHaveBeenCalledWith(1, 'PER_WORD', 2);
    expect(result).toEqual(rates);
  });

  it('findOne delegates to repository', async () => {
    const rate = mockTranslationRate();
    repo.findById.mockResolvedValue(rate);

    const result = await service.findOne(1, 1);
    expect(result).toEqual(rate);
  });

  it('create delegates to repository', async () => {
    const rate = mockTranslationRate();
    repo.create.mockResolvedValue(rate);

    const result = await service.create(1, {
      name: 'Standard',
      amount: 0.1,
      type: TranslationRateType.PER_WORD,
      currency: 'EUR',
    });
    expect(repo.create).toHaveBeenCalledWith(1, expect.any(Object));
    expect(result).toEqual(rate);
  });

  it('update delegates to repository', async () => {
    const rate = mockTranslationRate({ amount: 0.15 });
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
