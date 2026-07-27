export type ClientStatusHistoryModel = {
  id: number;
  clientId: number;
  userId: number;
  type: string;
  payload: string | null;
  createdAt: Date;
  user?: { id: number; name: string | null } | null;
};

export type LogClientStatusHistoryInput = {
  clientId: number;
  userId: number;
  type: string;
  payload?: Record<string, unknown>;
};

export abstract class ClientStatusHistoryRepository {
  abstract findByClient(clientId: number): Promise<ClientStatusHistoryModel[]>;
  abstract log(
    data: LogClientStatusHistoryInput,
  ): Promise<ClientStatusHistoryModel>;
  abstract logMany(entries: LogClientStatusHistoryInput[]): Promise<number>;
}
