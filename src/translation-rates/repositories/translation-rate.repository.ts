import { CreateTranslationRateInput } from '../dto/create-translation-rate.input';
import { UpdateTranslationRateInput } from '../dto/update-translation-rate.input';
import { TranslationRateModel } from '../types/translation-rate.type';

export abstract class TranslationRateRepository {
  abstract findAll(
    userId: number,
    type?: string,
    activityId?: number,
  ): Promise<TranslationRateModel[]>;
  abstract findById(id: number, userId: number): Promise<TranslationRateModel>;
  abstract create(
    userId: number,
    data: CreateTranslationRateInput,
  ): Promise<TranslationRateModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateTranslationRateInput,
  ): Promise<TranslationRateModel>;
  abstract delete(id: number, userId: number): Promise<void>;
}
