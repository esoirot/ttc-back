import { Injectable, NotFoundException } from '@nestjs/common';
import { taskVisibleTo } from '../../prisma8/access';
import { countOf } from '../../prisma8/count';
import { containsPattern } from '../../prisma8/like';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { CreateTaskInput } from '../dto/create-task.input';
import { UpdateTaskInput } from '../dto/update-task.input';
import { TaskModel } from '../types/task.type';
import { TaskConnectionModel, TaskRepository } from './task.repository';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'PAID';
type Row = NonNullable<
  Awaited<ReturnType<Prisma8Service['orm']['public']['Task']['first']>>
>;

function toModel(row: Row): TaskModel {
  return {
    ...row,
    checklistTitles: [...(row.checklistTitles ?? [])],
    dueDate: fromDb(row.dueDate),
    startDate: fromDb(row.startDate),
    createdAt: fromDb(row.createdAt),
    updatedAt: fromDb(row.updatedAt),
  } as TaskModel;
}

const date = (d: Date | null | undefined) =>
  d === undefined ? undefined : toDb(d);

@Injectable()
export class Prisma8TaskRepository implements TaskRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get tasks() {
    return this.db.orm.public.Task;
  }

  /** One page in (status, sortOrder, id) order, resuming after the cursor task. */
  private async page(
    base: ReturnType<Prisma8TaskRepository['tasks']['where']>,
    limit: number,
    cursor: number | undefined,
  ): Promise<TaskConnectionModel> {
    let query = base.orderBy([
      (t) => t.status.asc(),
      (t) => t.sortOrder.asc(),
      (t) => t.id.asc(),
    ]);
    if (cursor !== undefined) {
      const after = await this.tasks.first({ id: cursor });
      query = after
        ? query.cursor({
            status: after.status,
            sortOrder: after.sortOrder,
            id: after.id,
          })
        : query.where((t) => t.id.gt(cursor));
    }
    const rows = await query.limit(limit + 1).all();
    const total = await countOf(base);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map(toModel),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async findById(id: number, userId: number): Promise<TaskModel> {
    const task = await this.tasks.where(taskVisibleTo(userId)).first({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return toModel(task);
  }

  findByProject(
    projectId: number,
    userId: number,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<TaskConnectionModel> {
    let base = this.tasks
      .where({ projectId })
      .where((t) => t.project.some((p) => p.userId.eq(userId)));
    if (search)
      base = base.where((t) => t.title.ilike(containsPattern(search)));
    return this.page(base, pagination?.limit ?? 20, pagination?.cursor);
  }

  findByAssignee(
    assigneeId: number,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TaskConnectionModel> {
    return this.page(
      this.tasks.where({ assigneeId }),
      pagination?.limit ?? 50,
      pagination?.cursor,
    );
  }

  async create(data: CreateTaskInput): Promise<TaskModel> {
    const row = await this.tasks.create({
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      status: (data.status as TaskStatus | undefined) ?? 'TODO',
      dueDate: date(data.dueDate),
      wordCount: data.wordCount,
      startDate: date(data.startDate),
      recurring: data.recurring,
      reminderOffset: data.reminderOffset,
      updatedAt: nowDb(),
    });
    return toModel(row);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateTaskInput,
  ): Promise<TaskModel> {
    await this.findById(id, userId);
    const { id: _id, dueDate, startDate, status, ...fields } = data;
    const row = await this.tasks.where({ id }).update({
      ...fields,
      status: (status as TaskStatus | undefined) || undefined,
      dueDate: date(dueDate),
      startDate: date(startDate),
      updatedAt: nowDb(),
    });
    return toModel(row!);
  }

  async delete(id: number, userId: number): Promise<TaskModel> {
    const task = await this.tasks
      .where((t) => t.project.some((p) => p.userId.eq(userId)))
      .first({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    await this.tasks.where({ id }).delete();
    return toModel(task);
  }

  private async setChecklist(
    taskId: number,
    titles: (current: string[]) => string[] | null,
  ) {
    const task = await this.tasks.first({ id: taskId });
    if (!task) return false;
    const next = titles([...(task.checklistTitles ?? [])]);
    if (next)
      await this.tasks
        .where({ id: taskId })
        .update({ checklistTitles: next, updatedAt: nowDb() });
    return true;
  }

  async addChecklistTitle(taskId: number, title: string): Promise<void> {
    const found = await this.setChecklist(taskId, (t) =>
      t.includes(title) ? null : [...t, title],
    );
    if (!found) throw new NotFoundException(`Task ${taskId} not found`);
  }

  async renameChecklistTitle(
    taskId: number,
    oldTitle: string,
    newTitle: string,
  ): Promise<void> {
    await this.setChecklist(taskId, (t) =>
      t.map((x) => (x === oldTitle ? newTitle : x)),
    );
  }

  async removeChecklistTitle(taskId: number, title: string): Promise<void> {
    await this.setChecklist(taskId, (t) => t.filter((x) => x !== title));
  }
}
