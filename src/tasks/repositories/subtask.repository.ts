import { CreateSubtaskInput } from '../dto/create-subtask.input';
import { UpdateSubtaskInput } from '../dto/update-subtask.input';

export type SubtaskModel = {
  id: number;
  taskId: number;
  title: string;
  done: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class SubtaskRepository {
  abstract findByTask(taskId: number): Promise<SubtaskModel[]>;
  abstract create(data: CreateSubtaskInput): Promise<SubtaskModel>;
  abstract update(id: number, data: UpdateSubtaskInput): Promise<SubtaskModel>;
  abstract delete(id: number): Promise<SubtaskModel>;
}
