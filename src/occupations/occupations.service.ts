import { Injectable } from '@nestjs/common';
import { OccupationsRepository } from './repositories/occupations.repository';
import { CreateOccupationInput } from './dto/create-occupation.input';
import { UpdateOccupationInput } from './dto/update-occupation.input';
import { CreateChargeInput } from './dto/create-charge.input';
import { UpdateChargeInput } from './dto/update-charge.input';
import { OccupationModel, ChargeModel } from './types/occupation.type';

@Injectable()
export class OccupationsService {
  constructor(private readonly repo: OccupationsRepository) {}

  findAll(userId: number): Promise<OccupationModel[]> {
    return this.repo.findAll(userId);
  }

  findById(id: number, userId: number): Promise<OccupationModel> {
    return this.repo.findById(id, userId);
  }

  create(
    userId: number,
    data: CreateOccupationInput,
  ): Promise<OccupationModel> {
    return this.repo.create(userId, data);
  }

  update(
    id: number,
    userId: number,
    data: UpdateOccupationInput,
  ): Promise<OccupationModel> {
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
