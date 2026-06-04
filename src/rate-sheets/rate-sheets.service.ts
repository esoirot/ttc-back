import { Injectable } from '@nestjs/common';
import { RateSheetRepository } from './repositories/rate-sheet.repository';
import { RateSheetModel } from './types/rate-sheet.type';
import { CreateRateSheetInput } from './dto/create-rate-sheet.input';
import { UpdateRateSheetInput } from './dto/update-rate-sheet.input';

@Injectable()
export class RateSheetsService {
  constructor(private readonly repo: RateSheetRepository) {}

  findAll(userId: number): Promise<RateSheetModel[]> {
    return this.repo.findAll(userId);
  }

  findOne(id: number, userId: number): Promise<RateSheetModel> {
    return this.repo.findById(id, userId);
  }

  create(userId: number, input: CreateRateSheetInput): Promise<RateSheetModel> {
    return this.repo.create(userId, input);
  }

  update(
    id: number,
    userId: number,
    input: UpdateRateSheetInput,
  ): Promise<RateSheetModel> {
    return this.repo.update(id, userId, input);
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    return true;
  }
}
