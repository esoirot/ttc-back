import { Test, TestingModule } from '@nestjs/testing';
import { RateSheetsResolver } from './rate-sheets.resolver';
import { RateSheetsService } from './rate-sheets.service';
import type { CreateRateSheetInput } from './dto/create-rate-sheet.input';
import { mockRateSheet } from '../__test-helpers__/mock-factories';

describe('RateSheetsResolver', () => {
  let resolver: RateSheetsResolver;
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
        RateSheetsResolver,
        { provide: RateSheetsService, useValue: service },
      ],
    }).compile();

    resolver = module.get<RateSheetsResolver>(RateSheetsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findAll — delegates with user id', async () => {
    const sheets = [mockRateSheet()];
    service.findAll.mockResolvedValue(sheets);

    const result = await resolver.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual(sheets);
  });

  it('findOne — delegates to service', async () => {
    const sheet = mockRateSheet();
    service.findOne.mockResolvedValue(sheet);

    const result = await resolver.findOne(1, user);
    expect(service.findOne).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(sheet);
  });

  it('createRateSheet — delegates to service', async () => {
    const sheet = mockRateSheet();
    service.create.mockResolvedValue(sheet);

    const input: CreateRateSheetInput = {
      name: 'Standard',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      currency: 'EUR',
      pricePerWord: 0.1,
      matchRates: {
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
      },
    };

    const result = await resolver.createRateSheet(input, user);
    expect(service.create).toHaveBeenCalledWith(1, input);
    expect(result).toEqual(sheet);
  });

  it('updateRateSheet — delegates with id from input', async () => {
    const sheet = mockRateSheet({ name: 'Updated' });
    service.update.mockResolvedValue(sheet);

    const result = await resolver.updateRateSheet(
      { id: 1, name: 'Updated' },
      user,
    );
    expect(service.update).toHaveBeenCalledWith(1, 1, {
      id: 1,
      name: 'Updated',
    });
    expect(result).toEqual(sheet);
  });

  it('deleteRateSheet — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteRateSheet(1, user);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
