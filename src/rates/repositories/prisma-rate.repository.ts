import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RateRepository } from './rate.repository';
import { RateModel } from '../types/rate.type';
import { CreateRateInput } from '../dto/create-rate.input';
import { UpdateRateInput } from '../dto/update-rate.input';
import { RateType as PrismaRateType } from '../../generated/prisma/client';

@Injectable()
export class PrismaRateRepository implements RateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: number, type?: string): Promise<RateModel[]> {
    return this.prisma.rate.findMany({
      where: {
        userId,
        ...(type ? { type: type as PrismaRateType } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number, userId: number): Promise<RateModel> {
    const rate = await this.prisma.rate.findFirst({ where: { id, userId } });
    if (!rate) throw new NotFoundException(`Rate ${id} not found`);
    return rate;
  }

  create(userId: number, data: CreateRateInput): Promise<RateModel> {
    return this.prisma.rate.create({
      data: {
        userId,
        type: data.type,
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
      },
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateRateInput,
  ): Promise<RateModel> {
    const existing = await this.prisma.rate.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Rate ${id} not found`);
    const { id: _id, type, ...rest } = data;
    return this.prisma.rate.update({
      where: { id },
      data: {
        ...rest,
        ...(type ? { type: type } : {}),
      },
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.rate.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Rate ${id} not found`);
    await this.prisma.rate.delete({ where: { id } });
  }
}
