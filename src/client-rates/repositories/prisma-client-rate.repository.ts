import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ClientRateRepository } from './client-rate.repository';
import { ClientRateModel } from '../types/client-rate.type';
import { CreateClientRateInput } from '../dto/create-client-rate.input';
import { UpdateClientRateInput } from '../dto/update-client-rate.input';
import { RateType as PrismaRateType } from '../../generated/prisma/client';

function toModel(r: {
  id: number;
  clientId: number;
  userId: number;
  type: PrismaRateType;
  name: string;
  amount: { toNumber(): number };
  currency: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ClientRateModel {
  return { ...r, amount: r.amount.toNumber() };
}

@Injectable()
export class PrismaClientRateRepository implements ClientRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByClient(
    userId: number,
    clientId: number,
  ): Promise<ClientRateModel[]> {
    const rows = await this.prisma.clientRate.findMany({
      where: { clientId, client: { userId } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toModel);
  }

  async findById(id: number, userId: number): Promise<ClientRateModel> {
    const row = await this.prisma.clientRate.findFirst({
      where: { id, client: { userId } },
    });
    if (!row) throw new NotFoundException(`ClientRate ${id} not found`);
    return toModel(row);
  }

  create(
    userId: number,
    data: CreateClientRateInput,
  ): Promise<ClientRateModel> {
    return this.prisma.clientRate
      .create({
        data: {
          clientId: data.clientId,
          userId,
          type: data.type,
          name: data.name,
          amount: data.amount,
          currency: data.currency ?? 'EUR',
          description: data.description,
        },
      })
      .then(toModel);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateClientRateInput,
  ): Promise<ClientRateModel> {
    const existing = await this.prisma.clientRate.findFirst({
      where: { id, client: { userId } },
    });
    if (!existing) throw new NotFoundException(`ClientRate ${id} not found`);
    const { id: _id, type, ...rest } = data;
    return this.prisma.clientRate
      .update({
        where: { id },
        data: { ...rest, ...(type ? { type: type } : {}) },
      })
      .then(toModel);
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.clientRate.findFirst({
      where: { id, client: { userId } },
    });
    if (!existing) throw new NotFoundException(`ClientRate ${id} not found`);
    await this.prisma.clientRate.delete({ where: { id } });
  }
}
