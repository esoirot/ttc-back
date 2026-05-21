import { Injectable } from '@nestjs/common';
import { RateRepository } from './repositories/rate.repository';
import { RateModel } from './types/rate.type';
import { CreateRateInput } from './dto/create-rate.input';
import { UpdateRateInput } from './dto/update-rate.input';

@Injectable()
export class RatesService {
  constructor(private readonly repo: RateRepository) {}

  findAll(userId: number, type?: string): Promise<RateModel[]> {
    return this.repo.findAll(userId, type);
  }

  findOne(id: number, userId: number): Promise<RateModel> {
    return this.repo.findById(id, userId);
  }

  create(userId: number, input: CreateRateInput): Promise<RateModel> {
    return this.repo.create(userId, input);
  }

  update(
    id: number,
    userId: number,
    input: UpdateRateInput,
  ): Promise<RateModel> {
    return this.repo.update(id, userId, input);
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    return true;
  }
}
