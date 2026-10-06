import { Test, TestingModule } from '@nestjs/testing';
import { OccupationsResolver } from './occupations.resolver';
import { OccupationsService } from './occupations.service';
import { OccupationType, ChargeType } from './entities/occupation.entity';

describe('OccupationsResolver', () => {
  let resolver: OccupationsResolver;
  let service: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createCharge: jest.Mock;
    updateCharge: jest.Mock;
    deleteCharge: jest.Mock;
  };

  const user = { id: 1 };

  beforeEach(async () => {
    service = {
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
        OccupationsResolver,
        { provide: OccupationsService, useValue: service },
      ],
    }).compile();

    resolver = module.get<OccupationsResolver>(OccupationsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('myOccupations — delegates with user id', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await resolver.myOccupations(user);
    expect(service.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  it('occupation — delegates with id and user id', async () => {
    const occupation = {
      id: 1,
      userId: 1,
      type: 'TRANSLATOR',
      name: 'Translation',
    };
    service.findById.mockResolvedValue(occupation);

    const result = await resolver.occupation(user, 1);
    expect(service.findById).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(occupation);
  });

  it('createOccupation — delegates to service', async () => {
    const occupation = {
      id: 1,
      userId: 1,
      type: 'TRANSLATOR',
      name: 'Translation',
    };
    service.create.mockResolvedValue(occupation);

    const result = await resolver.createOccupation(user, {
      name: 'Translation',
      occupationType: OccupationType.TRANSLATOR,
    });
    expect(service.create).toHaveBeenCalledWith(1, {
      name: 'Translation',
      occupationType: OccupationType.TRANSLATOR,
    });
    expect(result).toEqual(occupation);
  });

  it('updateOccupation — delegates with id from input', async () => {
    const occupation = {
      id: 1,
      userId: 1,
      type: 'TRANSLATOR',
      name: 'Updated',
    };
    service.update.mockResolvedValue(occupation);

    const result = await resolver.updateOccupation(user, {
      id: 1,
      name: 'Updated',
    });
    expect(service.update).toHaveBeenCalledWith(1, 1, {
      id: 1,
      name: 'Updated',
    });
    expect(result).toEqual(occupation);
  });

  it('deleteOccupation — calls service and returns true', async () => {
    service.delete.mockResolvedValue(undefined);

    const result = await resolver.deleteOccupation(user, 1);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });

  it('createCharge — delegates to service', async () => {
    const charge = { id: 1, occupationId: 1, amount: 100 };
    service.createCharge.mockResolvedValue(charge);

    const result = await resolver.createCharge(user, {
      occupationId: 1,
      name: 'Service fee',
      amount: 100,
      type: ChargeType.FIXED,
    });
    expect(service.createCharge).toHaveBeenCalledWith(1, {
      occupationId: 1,
      name: 'Service fee',
      amount: 100,
      type: ChargeType.FIXED,
    });
    expect(result).toEqual(charge);
  });

  it('updateCharge — delegates with id from input', async () => {
    const charge = { id: 1, occupationId: 1, amount: 150 };
    service.updateCharge.mockResolvedValue(charge);

    const result = await resolver.updateCharge(user, {
      id: 1,
      amount: 150,
    });
    expect(service.updateCharge).toHaveBeenCalledWith(1, 1, {
      id: 1,
      amount: 150,
    });
    expect(result).toEqual(charge);
  });

  it('deleteCharge — calls service and returns true', async () => {
    service.deleteCharge.mockResolvedValue(undefined);

    const result = await resolver.deleteCharge(user, 1);
    expect(service.deleteCharge).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
