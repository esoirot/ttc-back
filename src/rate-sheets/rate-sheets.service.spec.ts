import { Test, TestingModule } from '@nestjs/testing';
import { RateSheetsService } from './rate-sheets.service';
import { RateSheetRepository } from './repositories/rate-sheet.repository';
import type { CreateRateSheetInput } from './dto/create-rate-sheet.input';
import { mockRateSheet } from '../__test-helpers__/mock-factories';

const matchRates = {
  perfectMatch: 0,
  cm: 0.1,
  repetitions: 0.3,
  repetitionsBetweenFiles: 0.3,
  match100: 0,
  match95_99: 0.2,
  match85_94: 0.5,
  match75_84: 0.7,
  match50_74: 0.85,
  referenceAdaptativeMT: 0.7,
  adaptativeMTWithLearning: 0.7,
  newWordsTA: 1,
};

describe('RateSheetsService', () => {
  let service: RateSheetsService;
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
        RateSheetsService,
        { provide: RateSheetRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<RateSheetsService>(RateSheetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll delegates to repository', async () => {
    const sheets = [mockRateSheet()];
    repo.findAll.mockResolvedValue(sheets);

    const result = await service.findAll(1);
    expect(repo.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual(sheets);
  });

  it('findOne delegates to repository', async () => {
    const sheet = mockRateSheet();
    repo.findById.mockResolvedValue(sheet);

    const result = await service.findOne(1, 1);
    expect(result).toEqual(sheet);
  });

  it('create delegates to repository', async () => {
    const sheet = mockRateSheet();
    repo.create.mockResolvedValue(sheet);

    const input: CreateRateSheetInput = {
      name: 'Standard',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      currency: 'EUR',
      pricePerWord: 0.1,
      matchRates,
    };

    const result = await service.create(1, input);
    expect(repo.create).toHaveBeenCalledWith(1, input);
    expect(result).toEqual(sheet);
  });

  it('update delegates to repository', async () => {
    const sheet = mockRateSheet({ name: 'Updated' });
    repo.update.mockResolvedValue(sheet);

    const result = await service.update(1, 1, { id: 1, name: 'Updated' });
    expect(result).toEqual(sheet);
  });

  it('delete returns true', async () => {
    repo.delete.mockResolvedValue(undefined);

    const result = await service.delete(1, 1);
    expect(repo.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
