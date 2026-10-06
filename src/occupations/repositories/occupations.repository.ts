import { CreateOccupationInput } from '../dto/create-occupation.input';
import { UpdateOccupationInput } from '../dto/update-occupation.input';
import { CreateChargeInput } from '../dto/create-charge.input';
import { UpdateChargeInput } from '../dto/update-charge.input';
import { OccupationModel, ChargeModel } from '../types/occupation.type';

export abstract class OccupationsRepository {
  abstract findAll(userId: number): Promise<OccupationModel[]>;
  abstract findById(id: number, userId: number): Promise<OccupationModel>;
  abstract create(
    userId: number,
    data: CreateOccupationInput,
  ): Promise<OccupationModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateOccupationInput,
  ): Promise<OccupationModel>;
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
