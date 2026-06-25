import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesResolver } from './activities.resolver';
import { ActivitiesService } from './activities.service';
import { ActivityType, ChargeType } from './entities/activity.entity';

describe('ActivitiesResolver', () => {
  let resolver: ActivitiesResolver;
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
        ActivitiesResolver,
        { provide: ActivitiesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<ActivitiesResolver>(ActivitiesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('myActivities — delegates with user id', async () => {
    service.findAll.mockResolvedValue([]);

    const result = await resolver.myActivities(user);
    expect(service.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  it('activity — delegates with id and user id', async () => {
    const activity = {
      id: 1,
      userId: 1,
      type: 'TRANSLATOR',
      name: 'Translation',
    };
    service.findById.mockResolvedValue(activity);

    const result = await resolver.activity(user, 1);
    expect(service.findById).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(activity);
  });

  it('createActivity — delegates to service', async () => {
    const activity = {
      id: 1,
      userId: 1,
      type: 'TRANSLATOR',
      name: 'Translation',
    };
    service.create.mockResolvedValue(activity);

    const result = await resolver.createActivity(user, {
      name: 'Translation',
      activityType: ActivityType.TRANSLATOR,
    });
    expect(service.create).toHaveBeenCalledWith(1, {
      name: 'Translation',
      activityType: ActivityType.TRANSLATOR,
    });
    expect(result).toEqual(activity);
  });

  it('updateActivity — delegates with id from input', async () => {
    const activity = { id: 1, userId: 1, type: 'TRANSLATOR', name: 'Updated' };
    service.update.mockResolvedValue(activity);

    const result = await resolver.updateActivity(user, {
      id: 1,
      name: 'Updated',
    });
    expect(service.update).toHaveBeenCalledWith(1, 1, {
      id: 1,
      name: 'Updated',
    });
    expect(result).toEqual(activity);
  });

  it('deleteActivity — calls service and returns true', async () => {
    service.delete.mockResolvedValue(undefined);

    const result = await resolver.deleteActivity(user, 1);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });

  it('createCharge — delegates to service', async () => {
    const charge = { id: 1, activityId: 1, amount: 100 };
    service.createCharge.mockResolvedValue(charge);

    const result = await resolver.createCharge(user, {
      activityId: 1,
      name: 'Service fee',
      amount: 100,
      type: ChargeType.FIXED,
    });
    expect(service.createCharge).toHaveBeenCalledWith(1, {
      activityId: 1,
      name: 'Service fee',
      amount: 100,
      type: ChargeType.FIXED,
    });
    expect(result).toEqual(charge);
  });

  it('updateCharge — delegates with id from input', async () => {
    const charge = { id: 1, activityId: 1, amount: 150 };
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
