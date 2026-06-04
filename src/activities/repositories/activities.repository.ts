import { CreateActivityInput } from '../dto/create-activity.input';
import { UpdateActivityInput } from '../dto/update-activity.input';
import { CreateChargeInput } from '../dto/create-charge.input';
import { UpdateChargeInput } from '../dto/update-charge.input';
import { ActivityModel, ChargeModel } from '../types/activity.type';

export abstract class ActivitiesRepository {
  abstract findAll(userId: number): Promise<ActivityModel[]>;
  abstract findById(id: number, userId: number): Promise<ActivityModel>;
  abstract create(
    userId: number,
    data: CreateActivityInput,
  ): Promise<ActivityModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateActivityInput,
  ): Promise<ActivityModel>;
  abstract delete(id: number, userId: number): Promise<void>;
  abstract createCharge(
    userId: number,
    data: CreateChargeInput,
  ): Promise<ChargeModel>;
  abstract updateCharge(
    id: number,
    userId: number,
    data: UpdateChargeInput,
  ): Promise<ChargeModel>;
  abstract deleteCharge(id: number, userId: number): Promise<void>;
}
