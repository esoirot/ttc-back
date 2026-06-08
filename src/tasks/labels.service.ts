import { Injectable } from '@nestjs/common';
import {
  TaskLabelRepository,
  TaskLabelModel,
} from './repositories/task-label.repository';
import { CreateTaskLabelInput } from './dto/create-task-label.input';

@Injectable()
export class LabelsService {
  constructor(private readonly repo: TaskLabelRepository) {}

  findByTask(taskId: number): Promise<TaskLabelModel[]> {
    return this.repo.findByTask(taskId);
  }

  create(input: CreateTaskLabelInput): Promise<TaskLabelModel> {
    return this.repo.create(input);
  }

  async delete(id: number): Promise<boolean> {
    await this.repo.delete(id);
    return true;
  }
}
