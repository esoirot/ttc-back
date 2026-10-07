import { Injectable } from '@nestjs/common';
import { taskVisibleTo } from '../../prisma8/access';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb } from '../../prisma8/timestamp';
import {
  LogActivityInput,
  TaskActivityModel,
  TaskActivityRepository,
} from './task-activity.repository';

type Row = {
  id: number;
  taskId: number | null;
  timeEntryId: number | null;
  userId: number;
  _type: string;
  payload: string | null;
  createdAt: string;
  user?: { id: number; name: string | null } | null;
};

function toModel({ _type, createdAt, ...row }: Row): TaskActivityModel {
  return { ...row, type: _type, createdAt: fromDb(createdAt) };
}

@Injectable()
export class Prisma8TaskActivityRepository implements TaskActivityRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get activities() {
    return this.db.orm.public.TaskActivity;
  }

  async findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<TaskActivityModel[]> {
    const rows = await this.activities
      .where((a) => a.taskId.in(taskIds))
      .where((a) => a.task.some(taskVisibleTo(userId)))
      .include('user', (u) => u.select('id', 'name'))
      .orderBy((a) => a.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async findByTimeEntryIds(
    timeEntryIds: number[],
    userId: number,
  ): Promise<TaskActivityModel[]> {
    const rows = await this.activities
      .where((a) => a.timeEntryId.in(timeEntryIds))
      .where((a) => a.timeEntry.some((e) => e.userId.eq(userId)))
      .include('user', (u) => u.select('id', 'name'))
      .orderBy((a) => a.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async log(data: LogActivityInput): Promise<TaskActivityModel> {
    const row = await this.activities.create({
      taskId: data.taskId ?? null,
      timeEntryId: data.timeEntryId ?? null,
      userId: data.userId,
      _type: data.type,
      payload: data.payload ? JSON.stringify(data.payload) : null,
    });
    return toModel(row);
  }
}
