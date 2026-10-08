import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma8Service, Prisma8Tx } from '../../prisma8/prisma8.service';
import { toNumeric } from '../../prisma8/numeric';
import { fromDb, nowDb } from '../../prisma8/timestamp';
import { toVarchar } from '../../prisma8/varchar';
import { CreateRateSheetInput } from '../dto/create-rate-sheet.input';
import { UpdateRateSheetInput } from '../dto/update-rate-sheet.input';
import { MatchRatesModel, RateSheetModel } from '../types/rate-sheet.type';
import { RateSheetRepository } from './rate-sheet.repository';

type Row = Omit<
  RateSheetModel,
  'pricePerWord' | 'matchRates' | 'createdAt' | 'updatedAt'
> & {
  pricePerWord: string;
  matchRates: unknown;
  createdAt: string;
  updatedAt: string;
};

function toModel({
  pricePerWord,
  matchRates,
  createdAt,
  updatedAt,
  ...row
}: Row): RateSheetModel {
  return {
    ...row,
    pricePerWord: Number(pricePerWord),
    matchRates: matchRates as MatchRatesModel,
    createdAt: fromDb(createdAt),
    updatedAt: fromDb(updatedAt),
  };
}

@Injectable()
export class Prisma8RateSheetRepository implements RateSheetRepository {
  constructor(private readonly db: Prisma8Service) {}

  /** Only one default sheet per client: clear the others. */
  private clearDefault(tx: Prisma8Tx, userId: number, clientId: number) {
    return tx.orm.public.RateSheet.where({ clientId, userId }).updateAndCount({
      isDefault: false,
    });
  }

  async findAll(userId: number): Promise<RateSheetModel[]> {
    const rows = await this.db.orm.public.RateSheet.where({ userId })
      .orderBy((s) => s.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async findById(id: number, userId: number): Promise<RateSheetModel> {
    const row = await this.db.orm.public.RateSheet.first({ id, userId });
    if (!row) throw new NotFoundException(`RateSheet ${id} not found`);
    return toModel(row);
  }

  async create(
    userId: number,
    data: CreateRateSheetInput,
  ): Promise<RateSheetModel> {
    const clientId = data.clientId ?? null;
    return this.db.transaction(async (tx) => {
      let isDefault = data.isDefault ?? false;
      if (clientId != null) {
        const existing = await tx.orm.public.RateSheet.where({
          clientId,
          userId,
        }).first();
        if (!existing) isDefault = true;
        if (isDefault) await this.clearDefault(tx, userId, clientId);
      }
      const row = await tx.orm.public.RateSheet.create({
        userId,
        occupationId: data.occupationId ?? null,
        clientId,
        name: data.name,
        description: data.description ?? null,
        sourceLanguage: toVarchar(data.sourceLanguage),
        targetLanguage: toVarchar(data.targetLanguage),
        currency: data.currency,
        pricePerWord: toNumeric(data.pricePerWord),
        matchRates: { ...data.matchRates },
        isDefault,
        updatedAt: nowDb(),
      });
      return toModel(row);
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateRateSheetInput,
  ): Promise<RateSheetModel> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.orm.public.RateSheet.first({ id, userId });
      if (!existing) throw new NotFoundException(`RateSheet ${id} not found`);
      const {
        id: _id,
        pricePerWord,
        matchRates,
        sourceLanguage,
        targetLanguage,
        ...rest
      } = data;
      const clientId =
        rest.clientId !== undefined ? rest.clientId : existing.clientId;
      if (rest.isDefault === true && clientId != null) {
        await this.clearDefault(tx, userId, clientId);
      }
      const row = await tx.orm.public.RateSheet.where({ id }).update({
        ...rest,
        sourceLanguage: toVarchar(sourceLanguage),
        targetLanguage: toVarchar(targetLanguage),
        pricePerWord:
          pricePerWord === undefined ? undefined : toNumeric(pricePerWord),
        matchRates: matchRates ? { ...matchRates } : undefined,
        updatedAt: nowDb(),
      });
      return toModel(row!);
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await this.db.orm.public.RateSheet.where({ id }).delete();
  }
}
