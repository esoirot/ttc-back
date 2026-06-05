import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RateSheetRepository } from './rate-sheet.repository';
import { RateSheetModel, MatchRatesModel } from '../types/rate-sheet.type';
import { CreateRateSheetInput } from '../dto/create-rate-sheet.input';
import { UpdateRateSheetInput } from '../dto/update-rate-sheet.input';

@Injectable()
export class PrismaRateSheetRepository implements RateSheetRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toModel(row: {
    id: number;
    userId: number;
    activityId: number | null;
    clientId: number | null;
    name: string;
    description: string | null;
    sourceLanguage: string;
    targetLanguage: string;
    currency: string;
    pricePerWord: { toNumber: () => number };
    matchRates: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): RateSheetModel {
    return {
      id: row.id,
      userId: row.userId,
      activityId: row.activityId,
      clientId: row.clientId,
      name: row.name,
      description: row.description,
      sourceLanguage: row.sourceLanguage,
      targetLanguage: row.targetLanguage,
      currency: row.currency,
      pricePerWord: row.pricePerWord.toNumber(),
      matchRates: row.matchRates as MatchRatesModel,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(userId: number): Promise<RateSheetModel[]> {
    const rows = await this.prisma.rateSheet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toModel(r));
  }

  async findById(id: number, userId: number): Promise<RateSheetModel> {
    const row = await this.prisma.rateSheet.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException(`RateSheet ${id} not found`);
    return this.toModel(row);
  }

  async create(
    userId: number,
    data: CreateRateSheetInput,
  ): Promise<RateSheetModel> {
    const row = await this.prisma.rateSheet.create({
      data: {
        userId,
        activityId: data.activityId ?? null,
        clientId: data.clientId ?? null,
        name: data.name,
        description: data.description,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        currency: data.currency,
        pricePerWord: data.pricePerWord,
        matchRates: { ...data.matchRates },
      },
    });
    return this.toModel(row);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateRateSheetInput,
  ): Promise<RateSheetModel> {
    const existing = await this.prisma.rateSheet.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`RateSheet ${id} not found`);
    const { id: _id, ...rest } = data;
    const row = await this.prisma.rateSheet.update({
      where: { id },
      data: {
        ...rest,
        matchRates: rest.matchRates ? { ...rest.matchRates } : undefined,
      },
    });
    return this.toModel(row);
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.rateSheet.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`RateSheet ${id} not found`);
    await this.prisma.rateSheet.delete({ where: { id } });
  }
}
