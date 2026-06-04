import { RateSheetModel } from '../types/rate-sheet.type';
import { CreateRateSheetInput } from '../dto/create-rate-sheet.input';
import { UpdateRateSheetInput } from '../dto/update-rate-sheet.input';

export abstract class RateSheetRepository {
  abstract findAll(userId: number): Promise<RateSheetModel[]>;
  abstract findById(id: number, userId: number): Promise<RateSheetModel>;
  abstract create(
    userId: number,
    data: CreateRateSheetInput,
  ): Promise<RateSheetModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateRateSheetInput,
  ): Promise<RateSheetModel>;
  abstract delete(id: number, userId: number): Promise<void>;
}
