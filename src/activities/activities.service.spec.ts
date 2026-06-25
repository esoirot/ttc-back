import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { ActivitiesRepository } from './repositories/activities.repository';
import { ActivityType, ChargeType } from './entities/activity.entity';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
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
        ActivitiesService,
        { provide: ActivitiesRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(ActivitiesService);
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
    const activity = { id: 1, userId: 1 };
    repo.findById.mockResolvedValue(activity);
    const result = await service.findById(1, 1);
    expect(repo.findById).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(activity);
  });

  it('create — delegates to repo', async () => {
    const activity = {
      id: 2,
      userId: 1,
      name: 'Translation',
      activityType: ActivityType.TRANSLATOR,
    };
    repo.create.mockResolvedValue(activity);
    const input = {
      name: 'Translation',
      activityType: ActivityType.TRANSLATOR,
    };
    const result = await service.create(1, input);
    expect(repo.create).toHaveBeenCalledWith(1, input);
    expect(result).toEqual(activity);
  });

  it('update — delegates to repo', async () => {
    const activity = { id: 1, userId: 1 };
    repo.update.mockResolvedValue(activity);
    const result = await service.update(1, 1, { id: 1, name: 'Renamed' });
    expect(repo.update).toHaveBeenCalledWith(1, 1, { id: 1, name: 'Renamed' });
    expect(result).toEqual(activity);
  });

  it('delete — delegates to repo', async () => {
    repo.delete.mockResolvedValue(undefined);
    await service.delete(1, 1);
    expect(repo.delete).toHaveBeenCalledWith(1, 1);
  });

  it('createCharge — delegates to repo', async () => {
    const charge = { id: 1, activityId: 1 };
    repo.createCharge.mockResolvedValue(charge);
    const chargeInput = {
      activityId: 1,
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
