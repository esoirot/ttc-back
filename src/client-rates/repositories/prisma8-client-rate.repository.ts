import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { toNumeric } from '../../prisma8/numeric';
import { fromDb, nowDb } from '../../prisma8/timestamp';
import { CreateClientRateInput } from '../dto/create-client-rate.input';
import { UpdateClientRateInput } from '../dto/update-client-rate.input';
import { ClientRateModel } from '../types/client-rate.type';
import { ClientRateRepository } from './client-rate.repository';

type Row = Omit<
  ClientRateModel,
  'type' | 'amount' | 'createdAt' | 'updatedAt'
> & {
  _type: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
};

function toModel({
  _type,
  amount,
  createdAt,
  updatedAt,
  ...row
}: Row): ClientRateModel {
  return {
    ...row,
    type: _type,
    amount: Number(amount),
    createdAt: fromDb(createdAt),
    updatedAt: fromDb(updatedAt),
  };
}

@Injectable()
export class Prisma8ClientRateRepository implements ClientRateRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get rates() {
    return this.db.orm.public.ClientRate;
  }

  /** A client rate belongs to whoever owns its client. */
  private owned(userId: number) {
    return this.rates.where((r) => r.client.some((c) => c.userId.eq(userId)));
  }

  async findByClient(
    userId: number,
    clientId: number,
  ): Promise<ClientRateModel[]> {
    const rows = await this.owned(userId)
      .where({ clientId })
      .orderBy((r) => r.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async findById(id: number, userId: number): Promise<ClientRateModel> {
    const row = await this.owned(userId).first({ id });
    if (!row) throw new NotFoundException(`ClientRate ${id} not found`);
    return toModel(row);
  }

  async create(
    userId: number,
    data: CreateClientRateInput,
  ): Promise<ClientRateModel> {
    const row = await this.rates.create({
      clientId: data.clientId,
      userId,
      _type: data.type,
      name: data.name,
      amount: toNumeric(data.amount),
      currency: data.currency,
      description: data.description ?? null,
      updatedAt: nowDb(),
    });
    return toModel(row);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateClientRateInput,
  ): Promise<ClientRateModel> {
    await this.findById(id, userId);
    const row = await this.rates.where({ id }).update({
      _type: data.type,
      name: data.name,
      amount: data.amount === undefined ? undefined : toNumeric(data.amount),
      currency: data.currency,
      description: data.description,
      updatedAt: nowDb(),
    });
    return toModel(row!);
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await this.rates.where({ id }).delete();
  }
}
