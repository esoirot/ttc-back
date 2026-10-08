export type TaskActivityModel = {
  id: number;
  taskId: number | null;
  timeEntryId: number | null;
  userId: number;
  type: string;
  payload: string | null;
  createdAt: Date;
  user?: { id: number; name: string | null } | null;
  task?: { id: number; title: string } | null;
};

export type TaskActivityConnectionModel = {
  items: TaskActivityModel[];
  nextCursor: number | null;
  total: number;
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
  /** The project's task activity, newest first; NotFound unless the user owns it. */
  abstract findByProject(
    projectId: number,
    userId: number,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TaskActivityConnectionModel>;
  abstract log(data: LogActivityInput): Promise<TaskActivityModel>;
}
