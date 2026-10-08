import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TaskRepository, TaskConnectionModel } from './task.repository';
import { TaskModel } from '../types/task.type';
import { CreateTaskInput } from '../dto/create-task.input';
import { UpdateTaskInput } from '../dto/update-task.input';
import { TaskStatus } from '../../generated/prisma/client';

// Postgres sorts an enum by declaration order, which Object.values keeps.
const STATUS_ORDER = Object.values(TaskStatus);

@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Keyset filter: tasks strictly after the cursor task in (status, sortOrder, id) order. */
  private async after(cursor: number | undefined) {
    if (cursor === undefined) return {};
    const c = await this.prisma.task.findUnique({
      where: { id: cursor },
      select: { status: true, sortOrder: true },
    });
    if (!c) return { id: { gt: cursor } };
    return {
      AND: [
        {
          OR: [
            {
              status: {
                in: STATUS_ORDER.slice(STATUS_ORDER.indexOf(c.status) + 1),
              },
            },
            { status: c.status, sortOrder: { gt: c.sortOrder } },
            { status: c.status, sortOrder: c.sortOrder, id: { gt: cursor } },
          ],
        },
      ],
    };
  }

  async findById(id: number, userId: number): Promise<TaskModel> {
    const task = await this.prisma.task.findFirst({
      where: { id, OR: [{ project: { userId } }, { assigneeId: userId }] },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findByProject(
    projectId: number,
    userId: number,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<TaskConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = {
      projectId,
      project: { userId },
      ...(search
        ? { title: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const where = { ...baseWhere, ...(await this.after(cursor)) };
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
    const where = { ...baseWhere, ...(await this.after(cursor)) };
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
        wordCount: data.wordCount,
        startDate: data.startDate,
        recurring: data.recurring,
        reminderOffset: data.reminderOffset,
      },
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateTaskInput,
  ): Promise<TaskModel> {
    const { id: _id, ...fields } = data;
    const task = await this.prisma.task.findFirst({
      where: { id, OR: [{ project: { userId } }, { assigneeId: userId }] },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.prisma.task.update({
      where: { id },
      data: {
        ...fields,
        ...(fields.status ? { status: fields.status } : {}),
      },
    });
  }

  async delete(id: number, userId: number): Promise<TaskModel> {
    const task = await this.prisma.task.findFirst({
      where: { id, project: { userId } },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.prisma.task.delete({ where: { id } });
  }

  async addChecklistTitle(taskId: number, title: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    if (task.checklistTitles.includes(title)) return;
    await this.prisma.task.update({
      where: { id: taskId },
      data: { checklistTitles: { push: title } },
    });
  }

  async renameChecklistTitle(
    taskId: number,
    oldTitle: string,
    newTitle: string,
  ): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;
    const titles = task.checklistTitles.map((t) =>
      t === oldTitle ? newTitle : t,
    );
    await this.prisma.task.update({
      where: { id: taskId },
      data: { checklistTitles: titles },
    });
  }

  async removeChecklistTitle(taskId: number, title: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        checklistTitles: task.checklistTitles.filter((t) => t !== title),
      },
    });
  }
}
