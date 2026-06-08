import { Injectable } from '@nestjs/common';
import {
  TaskActivityRepository,
  TaskActivityModel,
} from './repositories/task-activity.repository';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repo: TaskActivityRepository) {}

  findByTask(taskId: number): Promise<TaskActivityModel[]> {
    return this.repo.findByTask(taskId);
  }

  log(
    taskId: number,
    userId: number,
    type: string,
    payload?: Record<string, unknown>,
  ): Promise<TaskActivityModel> {
    return this.repo.log({ taskId, userId, type, payload });
  }
}
