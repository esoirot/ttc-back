import { Injectable } from '@nestjs/common';
import { TranslationRateRepository } from './repositories/translation-rate.repository';
import { TranslationRateModel } from './types/translation-rate.type';
import { CreateTranslationRateInput } from './dto/create-translation-rate.input';
import { UpdateTranslationRateInput } from './dto/update-translation-rate.input';

@Injectable()
export class TranslationRatesService {
  constructor(private readonly repo: TranslationRateRepository) {}

  findAll(userId: number, type?: string): Promise<TranslationRateModel[]> {
    return this.repo.findAll(userId, type);
  }

  findOne(id: number, userId: number): Promise<TranslationRateModel> {
    return this.repo.findById(id, userId);
  }

  create(
    userId: number,
    input: CreateTranslationRateInput,
  ): Promise<TranslationRateModel> {
    return this.repo.create(userId, input);
  }

  update(
    id: number,
    userId: number,
    input: UpdateTranslationRateInput,
  ): Promise<TranslationRateModel> {
    return this.repo.update(id, userId, input);
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    return true;
  }
}
