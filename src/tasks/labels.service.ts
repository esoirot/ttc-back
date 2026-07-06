import { Injectable } from '@nestjs/common';
import {
  TaskLabelRepository,
  TaskLabelModel,
} from './repositories/task-label.repository';
import { TaskRepository } from './repositories/task.repository';
import { CreateTaskLabelInput } from './dto/create-task-label.input';

@Injectable()
export class LabelsService {
  constructor(
    private readonly repo: TaskLabelRepository,
    private readonly taskRepo: TaskRepository,
  ) {}

  findByTask(taskId: number): Promise<TaskLabelModel[]> {
    return this.repo.findByTask(taskId);
  }

  async create(
    input: CreateTaskLabelInput,
    userId: number,
  ): Promise<TaskLabelModel> {
    // #19 — findById throws NotFoundException unless the caller owns the
    // task's project or is its assignee.
    await this.taskRepo.findById(input.taskId, userId);
    return this.repo.create(input);
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    return true;
  }
}
