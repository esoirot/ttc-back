import { Injectable } from '@nestjs/common';
import {
  ClientStatusHistoryRepository,
  ClientStatusHistoryModel,
  LogClientStatusHistoryInput,
} from './repositories/client-status-history.repository';

@Injectable()
export class ClientStatusHistoryService {
  constructor(private readonly repo: ClientStatusHistoryRepository) {}

  findByClientIds(
    clientIds: number[],
    userId: number,
  ): Promise<ClientStatusHistoryModel[]> {
    return this.repo.findByClientIds(clientIds, userId);
  }

  log(
    clientId: number,
    userId: number,
    type: string,
    payload?: Record<string, unknown>,
  ): Promise<ClientStatusHistoryModel> {
    return this.repo.log({ clientId, userId, type, payload });
  }

  logMany(entries: LogClientStatusHistoryInput[]): Promise<number> {
    return this.repo.logMany(entries);
  }
}
