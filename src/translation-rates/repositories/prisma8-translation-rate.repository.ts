import { assertOwned } from '../../prisma8/ownership';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, nowDb } from '../../prisma8/timestamp';
import { toVarchar } from '../../prisma8/varchar';
import { CreateTranslationRateInput } from '../dto/create-translation-rate.input';
import { UpdateTranslationRateInput } from '../dto/update-translation-rate.input';
import { TranslationRateModel } from '../types/translation-rate.type';
import { TranslationRateRepository } from './translation-rate.repository';

type RateType = 'HOURLY' | 'DAY' | 'PER_WORD' | 'FIXED';

type Row = Omit<TranslationRateModel, 'type' | 'createdAt' | 'updatedAt'> & {
  _type: string;
  createdAt: string;
  updatedAt: string;
};

/** A Prisma 8 TranslationRate row as the app model (`_type` -> `type`, Date timestamps). */
export function translationRateFromDb({
  _type,
  createdAt,
  updatedAt,
  ...row
}: Row): TranslationRateModel {
  return {
    ...row,
    type: _type,
    createdAt: fromDb(createdAt),
    updatedAt: fromDb(updatedAt),
  };
}

@Injectable()
export class Prisma8TranslationRateRepository implements TranslationRateRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get rates() {
    return this.db.orm.public.TranslationRate;
  }

  async findAll(
    userId: number,
    type?: string,
    occupationId?: number,
  ): Promise<TranslationRateModel[]> {
    // Prisma 8 ignores undefined filter fields.
    const rows = await this.rates
      .where({
        userId,
        _type: (type || undefined) as RateType | undefined,
        occupationId: occupationId ?? undefined,
      })
      .orderBy((r) => r.createdAt.asc())
      .all();
    return rows.map(translationRateFromDb);
  }

  async findById(id: number, userId: number): Promise<TranslationRateModel> {
    const rate = await this.rates.first({ id, userId });
    if (!rate) throw new NotFoundException(`TranslationRate ${id} not found`);
    return translationRateFromDb(rate);
  }

  private async assertRefs(
    userId: number,
    data: { clientId?: number | null; occupationId?: number | null },
  ) {
    await assertOwned(this.db.orm, userId, 'Client', data.clientId);
    await assertOwned(this.db.orm, userId, 'Occupation', data.occupationId);
  }

  async create(
    userId: number,
    data: CreateTranslationRateInput,
  ): Promise<TranslationRateModel> {
    await this.assertRefs(userId, data);
    const row = await this.rates.create({
      userId,
      occupationId: data.occupationId ?? null,
      _type: data.type,
      clientId: data.clientId ?? null,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      description: data.description ?? null,
      sourceLanguage: toVarchar(data.sourceLanguage ?? null),
      targetLanguage: toVarchar(data.targetLanguage ?? null),
      updatedAt: nowDb(),
    });
    return translationRateFromDb(row);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateTranslationRateInput,
  ): Promise<TranslationRateModel> {
    await this.findById(id, userId);
    await this.assertRefs(userId, data);
    const row = await this.rates.where({ id }).update({
      _type: data.type || undefined,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      occupationId: data.occupationId,
      clientId: data.clientId,
      sourceLanguage: toVarchar(data.sourceLanguage),
      targetLanguage: toVarchar(data.targetLanguage),
      updatedAt: nowDb(),
    });
    return translationRateFromDb(row!);
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await this.rates.where({ id }).delete();
  }
}
