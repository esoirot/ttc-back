import { CreateRateInput } from '../dto/create-rate.input';
import { UpdateRateInput } from '../dto/update-rate.input';
import { RateModel } from '../types/rate.type';

export abstract class RateRepository {
  abstract findAll(userId: number, type?: string): Promise<RateModel[]>;
  abstract findById(id: number, userId: number): Promise<RateModel>;
  abstract create(userId: number, data: CreateRateInput): Promise<RateModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateRateInput,
  ): Promise<RateModel>;
  abstract delete(id: number, userId: number): Promise<void>;
}
