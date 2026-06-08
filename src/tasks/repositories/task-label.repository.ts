import { CreateTaskLabelInput } from '../dto/create-task-label.input';

export type TaskLabelModel = {
  id: number;
  taskId: number;
  name: string;
  color: string;
  createdAt: Date;
};

export abstract class TaskLabelRepository {
  abstract findByTask(taskId: number): Promise<TaskLabelModel[]>;
  abstract create(data: CreateTaskLabelInput): Promise<TaskLabelModel>;
  abstract delete(id: number): Promise<TaskLabelModel>;
}
