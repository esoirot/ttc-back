import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TaskRepository, TaskConnectionModel } from './task.repository';
import { TaskModel } from '../types/task.type';
import { CreateTaskInput } from '../dto/create-task.input';
import { UpdateTaskInput } from '../dto/update-task.input';
import { TaskStatus } from '../../generated/prisma/client';

@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<TaskModel> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findByProject(
    projectId: number,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TaskConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = { projectId };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const total = await this.prisma.task.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor, total };
  }

  async findByAssignee(
    assigneeId: number,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TaskConnectionModel> {
    const limit = pagination?.limit ?? 50;
    const cursor = pagination?.cursor;
    const baseWhere = { assigneeId };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const total = await this.prisma.task.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor, total };
  }

  async create(data: CreateTaskInput): Promise<TaskModel> {
    return this.prisma.task.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        status: (data.status as TaskStatus | undefined) ?? 'TODO',
        dueDate: data.dueDate,
      },
    });
  }

  async update(id: number, data: UpdateTaskInput): Promise<TaskModel> {
    const { id: _id, ...fields } = data;
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.prisma.task.update({
      where: { id },
      data: {
        ...fields,
        ...(fields.status ? { status: fields.status } : {}),
      },
    });
  }

  async delete(id: number): Promise<TaskModel> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.prisma.task.delete({ where: { id } });
  }
}
