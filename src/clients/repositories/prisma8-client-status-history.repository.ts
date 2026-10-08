import { Injectable } from '@nestjs/common';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb } from '../../prisma8/timestamp';
import {
  ClientStatusHistoryModel,
  ClientStatusHistoryRepository,
  LogClientStatusHistoryInput,
} from './client-status-history.repository';

type Row = Omit<ClientStatusHistoryModel, 'type' | 'createdAt'> & {
  _type: string;
  createdAt: string;
};

function toModel({ _type, createdAt, ...row }: Row): ClientStatusHistoryModel {
  return { ...row, type: _type, createdAt: fromDb(createdAt) };
}

const toRow = (e: LogClientStatusHistoryInput) => ({
  clientId: e.clientId,
  userId: e.userId,
  _type: e.type,
  payload: e.payload ? JSON.stringify(e.payload) : null,
});

@Injectable()
export class Prisma8ClientStatusHistoryRepository implements ClientStatusHistoryRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get history() {
    return this.db.orm.public.ClientStatusHistory;
  }

  async findByClientIds(
    clientIds: number[],
    userId: number,
  ): Promise<ClientStatusHistoryModel[]> {
    const rows = await this.history
      .where((h) => h.clientId.in(clientIds))
      .where((h) => h.client.some((c) => c.userId.eq(userId)))
      .include('user', (u) => u.select('id', 'name'))
      .orderBy((h) => h.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async log(
    data: LogClientStatusHistoryInput,
  ): Promise<ClientStatusHistoryModel> {
    return toModel(await this.history.create(toRow(data)));
  }

  async logMany(entries: LogClientStatusHistoryInput[]): Promise<number> {
    return this.history.createAndCount(entries.map(toRow));
  }
}
