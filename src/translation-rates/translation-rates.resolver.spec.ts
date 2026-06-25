import { Test, TestingModule } from '@nestjs/testing';
import { TranslationRatesResolver } from './translation-rates.resolver';
import { TranslationRatesService } from './translation-rates.service';
import { TranslationRateType } from './entities/translation-rate.entity';
import { mockTranslationRate } from '../__test-helpers__/mock-factories';

describe('TranslationRatesResolver', () => {
  let resolver: TranslationRatesResolver;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const user = { id: 1, role: 'USER' };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationRatesResolver,
        { provide: TranslationRatesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<TranslationRatesResolver>(TranslationRatesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findAll — delegates with type and activityId filters', async () => {
    const rates = [mockTranslationRate()];
    service.findAll.mockResolvedValue(rates);

    const result = await resolver.findAll(
      user,
      TranslationRateType.PER_WORD,
      3,
    );
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      TranslationRateType.PER_WORD,
      3,
    );
    expect(result).toEqual(rates);
  });

  it('findOne — delegates to service', async () => {
    const rate = mockTranslationRate();
    service.findOne.mockResolvedValue(rate);

    const result = await resolver.findOne(1, user);
    expect(service.findOne).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(rate);
  });

  it('createTranslationRate — delegates to service', async () => {
    const rate = mockTranslationRate();
    service.create.mockResolvedValue(rate);

    const result = await resolver.createTranslationRate(
      {
        name: 'Standard',
        amount: 0.1,
        type: TranslationRateType.PER_WORD,
        currency: 'EUR',
      },
      user,
    );
    expect(service.create).toHaveBeenCalledWith(1, expect.any(Object));
    expect(result).toEqual(rate);
  });

  it('updateTranslationRate — delegates with id from input', async () => {
    const rate = mockTranslationRate({ amount: 0.15 });
    service.update.mockResolvedValue(rate);

    const result = await resolver.updateTranslationRate(
      { id: 1, amount: 0.15 },
      user,
    );
    expect(service.update).toHaveBeenCalledWith(1, 1, { id: 1, amount: 0.15 });
    expect(result).toEqual(rate);
  });

  it('deleteTranslationRate — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteTranslationRate(1, user);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
