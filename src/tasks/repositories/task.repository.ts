import { CreateTaskInput } from '../dto/create-task.input';
import { UpdateTaskInput } from '../dto/update-task.input';
import { TaskModel } from '../types/task.type';

export interface TaskConnectionModel {
  items: TaskModel[];
  nextCursor: number | null;
  total: number;
}

type PaginationArgs = { limit?: number; cursor?: number };

export abstract class TaskRepository {
  abstract findById(id: number): Promise<TaskModel>;
  abstract findByProject(
    projectId: number,
    pagination?: PaginationArgs,
  ): Promise<TaskConnectionModel>;
  abstract findByAssignee(
    assigneeId: number,
    pagination?: PaginationArgs,
  ): Promise<TaskConnectionModel>;
  abstract create(data: CreateTaskInput): Promise<TaskModel>;
  abstract update(id: number, data: UpdateTaskInput): Promise<TaskModel>;
  abstract delete(id: number): Promise<TaskModel>;
  abstract addChecklistTitle(taskId: number, title: string): Promise<void>;
  abstract renameChecklistTitle(
    taskId: number,
    oldTitle: string,
    newTitle: string,
  ): Promise<void>;
  abstract removeChecklistTitle(taskId: number, title: string): Promise<void>;
}
