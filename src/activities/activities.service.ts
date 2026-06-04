import { Injectable } from '@nestjs/common';
import { ActivitiesRepository } from './repositories/activities.repository';
import { CreateActivityInput } from './dto/create-activity.input';
import { UpdateActivityInput } from './dto/update-activity.input';
import { CreateChargeInput } from './dto/create-charge.input';
import { UpdateChargeInput } from './dto/update-charge.input';
import { ActivityModel, ChargeModel } from './types/activity.type';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repo: ActivitiesRepository) {}

  findAll(userId: number): Promise<ActivityModel[]> {
    return this.repo.findAll(userId);
  }

  findById(id: number, userId: number): Promise<ActivityModel> {
    return this.repo.findById(id, userId);
  }

  create(userId: number, data: CreateActivityInput): Promise<ActivityModel> {
    return this.repo.create(userId, data);
  }

  update(
    id: number,
    userId: number,
    data: UpdateActivityInput,
  ): Promise<ActivityModel> {
    return this.repo.update(id, userId, data);
  }

  delete(id: number, userId: number): Promise<void> {
    return this.repo.delete(id, userId);
  }

  createCharge(userId: number, data: CreateChargeInput): Promise<ChargeModel> {
    return this.repo.createCharge(userId, data);
  }

  updateCharge(
    id: number,
    userId: number,
    data: UpdateChargeInput,
  ): Promise<ChargeModel> {
    return this.repo.updateCharge(id, userId, data);
  }

  deleteCharge(id: number, userId: number): Promise<void> {
    return this.repo.deleteCharge(id, userId);
  }
}
