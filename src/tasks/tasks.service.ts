import { Injectable } from '@nestjs/common';
import {
  TaskRepository,
  TaskConnectionModel,
} from './repositories/task.repository';
import { ActivitiesService } from './activities.service';
import { TaskModel } from './types/task.type';
import { CreateTaskInput } from './dto/create-task.input';
import { UpdateTaskInput } from './dto/update-task.input';
import { TaskStatus } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

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

  async create(input: CreateTaskInput, userId: number): Promise<TaskModel> {
    const task = await this.repo.create(input);
    await this.activitiesService.log(task.id, userId, 'CREATED');
    return task;
  }

  async update(
    id: number,
    input: UpdateTaskInput,
    userId: number,
  ): Promise<TaskModel> {
    const before = await this.repo.findById(id);
    const task = await this.repo.update(id, input);
    if (input.title !== undefined && input.title !== before.title) {
      await this.activitiesService.log(id, userId, 'TITLE_CHANGED', {
        from: before.title,
        to: input.title,
      });
    }
    if (
      input.description !== undefined &&
      input.description !== (before.description ?? '')
    ) {
      await this.activitiesService.log(id, userId, 'DESCRIPTION_CHANGED');
    }
    if (
      input.status !== undefined &&
      input.status !== (before.status as TaskStatus)
    ) {
      await this.activitiesService.log(id, userId, 'STATUS_CHANGED', {
        from: before.status,
        to: input.status,
      });
    }
    if (
      input.dueDate !== undefined &&
      String(input.dueDate) !== String(before.dueDate)
    ) {
      await this.activitiesService.log(id, userId, 'DUE_DATE_SET', {
        to: input.dueDate,
      });
    }
    if (
      input.assigneeId !== undefined &&
      input.assigneeId !== before.assigneeId
    ) {
      await this.activitiesService.log(id, userId, 'ASSIGNED', {
        to: input.assigneeId,
      });
    }
    return task;
  }

  async delete(id: number): Promise<boolean> {
    await this.repo.delete(id);
    return true;
  }
}
