import { Injectable, NotFoundException } from '@nestjs/common';
import { and } from '@prisma/orm-postgres/orm-client';
import { taskVisibleTo } from '../../prisma8/access';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { CreateSubtaskInput } from '../dto/create-subtask.input';
import { UpdateSubtaskInput } from '../dto/update-subtask.input';
import { SubtaskModel, SubtaskRepository } from './subtask.repository';

type Row = Omit<SubtaskModel, 'dueDate' | 'createdAt' | 'updatedAt'> & {
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

function toModel(row: Row): SubtaskModel {
  return {
    ...row,
    dueDate: fromDb(row.dueDate),
    createdAt: fromDb(row.createdAt),
    updatedAt: fromDb(row.updatedAt),
  };
}

@Injectable()
export class Prisma8SubtaskRepository implements SubtaskRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get subtasks() {
    return this.db.orm.public.Subtask;
  }

  private visible(userId: number) {
    return this.subtasks.where((s) => s.task.some(taskVisibleTo(userId)));
  }

  async findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<SubtaskModel[]> {
    const rows = await this.visible(userId)
      .where((s) => s.taskId.in(taskIds))
      .orderBy((s) => s.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async findById(id: number, userId: number): Promise<SubtaskModel> {
    const s = await this.visible(userId).first({ id });
    if (!s) throw new NotFoundException(`Subtask ${id} not found`);
    return toModel(s);
  }

  async create(data: CreateSubtaskInput): Promise<SubtaskModel> {
    const row = await this.subtasks.create({
      taskId: data.taskId,
      checklistTitle: data.checklistTitle ?? null,
      title: data.title,
      dueDate: data.dueDate === undefined ? undefined : toDb(data.dueDate),
      wordCount: data.wordCount,
      countInTotal: data.countInTotal ?? undefined,
      updatedAt: nowDb(),
    });
    return toModel(row);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateSubtaskInput,
  ): Promise<SubtaskModel> {
    await this.findById(id, userId);
    const row = await this.subtasks.where({ id }).update({
      checklistTitle: data.checklistTitle,
      title: data.title,
      done: data.done,
      dueDate: data.dueDate === undefined ? undefined : toDb(data.dueDate),
      wordCount: data.wordCount,
      countInTotal: data.countInTotal ?? undefined,
      updatedAt: nowDb(),
    });
    return toModel(row!);
  }

  async delete(id: number, userId: number): Promise<SubtaskModel> {
    const existing = await this.findById(id, userId);
    await this.subtasks.where({ id }).delete();
    return existing;
  }

  renameChecklist(
    taskId: number,
    oldTitle: string,
    newTitle: string,
  ): Promise<number> {
    return this.subtasks
      .where({ taskId, checklistTitle: oldTitle })
      .updateAndCount({ checklistTitle: newTitle });
  }

  deleteByChecklist(taskId: number, title: string): Promise<number> {
    return this.subtasks
      .where({ taskId, checklistTitle: title })
      .deleteAndCount();
  }

  async sumWordsByProjectIds(
    projectIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    const [taskSums, items] = await Promise.all([
      this.db.orm.public.Task.where((t) =>
        and(
          t.projectId.in(projectIds),
          t.project.some((p) => p.userId.eq(userId)),
        ),
      )
        .groupBy('projectId')
        .aggregate((a) => ({ words: a.sum('wordCount') })),
      this.subtasks
        .where({ countInTotal: true })
        .where((s) =>
          s.task.some((t) =>
            and(
              t.projectId.in(projectIds),
              t.project.some((p) => p.userId.eq(userId)),
            ),
          ),
        )
        .include('task', (t) => t.select('projectId'))
        .all(),
    ]);
    const totals = new Map<number, number>();
    const add = (projectId: number, words: number | null) => {
      if (!words) return;
      totals.set(projectId, (totals.get(projectId) ?? 0) + words);
    };
    for (const t of taskSums) add(t.projectId, t.words);
    // Subtask.taskId is required, so the included task is never null.
    for (const i of items) add(i.task!.projectId, i.wordCount);
    return totals;
  }
}
