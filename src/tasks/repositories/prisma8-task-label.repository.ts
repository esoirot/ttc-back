import { Injectable, NotFoundException } from '@nestjs/common';
import { taskVisibleTo } from '../../prisma8/access';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb } from '../../prisma8/timestamp';
import { CreateTaskLabelInput } from '../dto/create-task-label.input';
import { TaskLabelModel, TaskLabelRepository } from './task-label.repository';

function toModel(
  row: Omit<TaskLabelModel, 'createdAt'> & { createdAt: string },
): TaskLabelModel {
  return { ...row, createdAt: fromDb(row.createdAt) };
}

@Injectable()
export class Prisma8TaskLabelRepository implements TaskLabelRepository {
  constructor(private readonly db: Prisma8Service) {}

  private visible(userId: number) {
    return this.db.orm.public.TaskLabel.where((l) =>
      l.task.some(taskVisibleTo(userId)),
    );
  }

  async findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<TaskLabelModel[]> {
    const rows = await this.visible(userId)
      .where((l) => l.taskId.in(taskIds))
      .orderBy((l) => l.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async create(data: CreateTaskLabelInput): Promise<TaskLabelModel> {
    const row = await this.db.orm.public.TaskLabel.create({
      taskId: data.taskId,
      name: data.name,
      color: data.color ?? '#6B7280',
    });
    return toModel(row);
  }

  async delete(id: number, userId: number): Promise<TaskLabelModel> {
    const label = await this.visible(userId).first({ id });
    if (!label) throw new NotFoundException(`Label ${id} not found`);
    await this.db.orm.public.TaskLabel.where({ id }).delete();
    return toModel(label);
  }
}
