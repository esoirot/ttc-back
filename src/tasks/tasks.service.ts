import { Injectable } from '@nestjs/common';
import {
  TaskRepository,
  TaskConnectionModel,
} from './repositories/task.repository';
import { TaskModel } from './types/task.type';
import { CreateTaskInput } from './dto/create-task.input';
import { UpdateTaskInput } from './dto/update-task.input';

@Injectable()
export class TasksService {
  constructor(private readonly repo: TaskRepository) {}

  findOne(id: number): Promise<TaskModel> {
    return this.repo.findById(id);
  }

  findByProject(
    projectId: number,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TaskConnectionModel> {
    return this.repo.findByProject(projectId, pagination);
  }

  findByAssignee(
    assigneeId: number,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TaskConnectionModel> {
    return this.repo.findByAssignee(assigneeId, pagination);
  }

  create(input: CreateTaskInput): Promise<TaskModel> {
    return this.repo.create(input);
  }

  update(id: number, input: UpdateTaskInput): Promise<TaskModel> {
    return this.repo.update(id, input);
  }

  async delete(id: number): Promise<boolean> {
    await this.repo.delete(id);
    return true;
  }
}
