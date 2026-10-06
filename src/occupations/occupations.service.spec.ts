import { Test, TestingModule } from '@nestjs/testing';
import { OccupationsService } from './occupations.service';
import { OccupationsRepository } from './repositories/occupations.repository';
import { OccupationType, ChargeType } from './entities/occupation.entity';

describe('OccupationsService', () => {
  let service: OccupationsService;
  let repo: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createCharge: jest.Mock;
    updateCharge: jest.Mock;
    deleteCharge: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createCharge: jest.fn(),
      updateCharge: jest.fn(),
      deleteCharge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OccupationsService,
        { provide: OccupationsRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(OccupationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll — delegates to repo', async () => {
    repo.findAll.mockResolvedValue([]);
    const result = await service.findAll(1);
    expect(repo.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  it('findById — delegates to repo', async () => {
    const occupation = { id: 1, userId: 1 };
    repo.findById.mockResolvedValue(occupation);
    const result = await service.findById(1, 1);
    expect(repo.findById).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(occupation);
  });

  it('create — delegates to repo', async () => {
    const occupation = {
      id: 2,
      userId: 1,
      name: 'Translation',
      occupationType: OccupationType.TRANSLATOR,
    };
    repo.create.mockResolvedValue(occupation);
    const input = {
      name: 'Translation',
      occupationType: OccupationType.TRANSLATOR,
    };
    const result = await service.create(1, input);
    expect(repo.create).toHaveBeenCalledWith(1, input);
    expect(result).toEqual(occupation);
  });

  it('update — delegates to repo', async () => {
    const occupation = { id: 1, userId: 1 };
    repo.update.mockResolvedValue(occupation);
    const result = await service.update(1, 1, { id: 1, name: 'Renamed' });
    expect(repo.update).toHaveBeenCalledWith(1, 1, { id: 1, name: 'Renamed' });
    expect(result).toEqual(occupation);
  });

  it('delete — delegates to repo', async () => {
    repo.delete.mockResolvedValue(undefined);
    await service.delete(1, 1);
    expect(repo.delete).toHaveBeenCalledWith(1, 1);
  });

  it('createCharge — delegates to repo', async () => {
    const charge = { id: 1, occupationId: 1 };
    repo.createCharge.mockResolvedValue(charge);
    const chargeInput = {
      occupationId: 1,
      name: 'Service fee',
      amount: 100,
      type: ChargeType.FIXED,
    };
    const result = await service.createCharge(1, chargeInput);
    expect(repo.createCharge).toHaveBeenCalledWith(1, chargeInput);
    expect(result).toEqual(charge);
  });

  it('updateCharge — delegates to repo', async () => {
    const charge = { id: 1, amount: 200 };
    repo.updateCharge.mockResolvedValue(charge);
    const result = await service.updateCharge(1, 1, { id: 1, amount: 200 });
    expect(repo.updateCharge).toHaveBeenCalledWith(1, 1, {
      id: 1,
      amount: 200,
    });
    expect(result).toEqual(charge);
  });

  it('deleteCharge — delegates to repo', async () => {
    repo.deleteCharge.mockResolvedValue(undefined);
    await service.deleteCharge(1, 1);
    expect(repo.deleteCharge).toHaveBeenCalledWith(1, 1);
  });
});
