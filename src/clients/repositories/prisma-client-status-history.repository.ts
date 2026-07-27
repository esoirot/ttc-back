import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  ClientStatusHistoryRepository,
  ClientStatusHistoryModel,
  LogClientStatusHistoryInput,
} from './client-status-history.repository';

@Injectable()
export class PrismaClientStatusHistoryRepository implements ClientStatusHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByClient(clientId: number): Promise<ClientStatusHistoryModel[]> {
    return this.prisma.clientStatusHistory.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  log(data: LogClientStatusHistoryInput): Promise<ClientStatusHistoryModel> {
    return this.prisma.clientStatusHistory.create({
      data: {
        clientId: data.clientId,
        userId: data.userId,
        type: data.type,
        payload: data.payload ? JSON.stringify(data.payload) : null,
      },
    });
  }

  async logMany(entries: LogClientStatusHistoryInput[]): Promise<number> {
    if (entries.length === 0) return 0;
    const { count } = await this.prisma.clientStatusHistory.createMany({
      data: entries.map((e) => ({
        clientId: e.clientId,
        userId: e.userId,
        type: e.type,
        payload: e.payload ? JSON.stringify(e.payload) : null,
      })),
    });
    return count;
  }
}
