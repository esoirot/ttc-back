export type TaskActivityModel = {
  id: number;
  taskId: number | null;
  timeEntryId: number | null;
  userId: number;
  type: string;
  payload: string | null;
  createdAt: Date;
  user?: { id: number; name: string | null } | null;
};

export type LogActivityInput = {
  taskId?: number;
  timeEntryId?: number;
  userId: number;
  type: string;
  payload?: Record<string, unknown>;
};

export abstract class TaskActivityRepository {
  abstract findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<TaskActivityModel[]>;
  abstract findByTimeEntryIds(
    timeEntryIds: number[],
    userId: number,
  ): Promise<TaskActivityModel[]>;
  abstract log(data: LogActivityInput): Promise<TaskActivityModel>;
}
