import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TranslationRateRepository } from './translation-rate.repository';
import { TranslationRateModel } from '../types/translation-rate.type';
import { CreateTranslationRateInput } from '../dto/create-translation-rate.input';
import { UpdateTranslationRateInput } from '../dto/update-translation-rate.input';
import {
  RateType as PrismaRateType,
  Prisma,
} from '../../generated/prisma/client';

@Injectable()
export class PrismaTranslationRateRepository implements TranslationRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: number, type?: string): Promise<TranslationRateModel[]> {
    return this.prisma.translationRate.findMany({
      where: {
        userId,
        ...(type ? { type: type as PrismaRateType } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number, userId: number): Promise<TranslationRateModel> {
    const rate = await this.prisma.translationRate.findFirst({
      where: { id, userId },
    });
    if (!rate) throw new NotFoundException(`TranslationRate ${id} not found`);
    return rate;
  }

  create(
    userId: number,
    data: CreateTranslationRateInput,
  ): Promise<TranslationRateModel> {
    return this.prisma.translationRate.create({
      data: {
        userId,
        type: data.type,
        clientId: data.clientId ?? null,
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        sourceLanguage: data.sourceLanguage ?? null,
        targetLanguage: data.targetLanguage ?? null,
      },
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateTranslationRateInput,
  ): Promise<TranslationRateModel> {
    const existing = await this.prisma.translationRate.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`TranslationRate ${id} not found`);
    const updateData: Prisma.TranslationRateUncheckedUpdateInput = {};
    if (data.type) updateData.type = data.type;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.sourceLanguage !== undefined)
      updateData.sourceLanguage = data.sourceLanguage;
    if (data.targetLanguage !== undefined)
      updateData.targetLanguage = data.targetLanguage;
    return this.prisma.translationRate.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.translationRate.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`TranslationRate ${id} not found`);
    await this.prisma.translationRate.delete({ where: { id } });
  }
}
