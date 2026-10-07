import { Injectable } from '@nestjs/common';
import { taskVisibleTo } from '../../prisma8/access';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb } from '../../prisma8/timestamp';
import {
  TaskAttachmentModel,
  TaskAttachmentRepository,
} from './task-attachment.repository';

type Row = Omit<TaskAttachmentModel, 'type' | 'createdAt'> & {
  _type: string;
  createdAt: string;
};

function toModel({ _type, createdAt, ...row }: Row): TaskAttachmentModel {
  return { ...row, type: _type, createdAt: fromDb(createdAt) };
}

type CreateInput = Parameters<TaskAttachmentRepository['create']>[0];
type UpdateInput = Parameters<TaskAttachmentRepository['update']>[1];

@Injectable()
export class Prisma8TaskAttachmentRepository implements TaskAttachmentRepository {
  constructor(private readonly db: Prisma8Service) {}

  private visible(userId: number) {
    return this.db.orm.public.TaskAttachment.where((a) =>
      a.task.some(taskVisibleTo(userId)),
    );
  }

  async findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<TaskAttachmentModel[]> {
    const rows = await this.visible(userId)
      .where((a) => a.taskId.in(taskIds))
      .orderBy((a) => a.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async findById(
    id: number,
    userId: number,
  ): Promise<TaskAttachmentModel | null> {
    const row = await this.visible(userId).first({ id });
    return row ? toModel(row) : null;
  }

  async create(data: CreateInput): Promise<TaskAttachmentModel> {
    const row = await this.db.orm.public.TaskAttachment.create({
      taskId: data.taskId,
      _type: data.type,
      fileName: data.fileName ?? null,
      url: data.url,
      displayText: data.displayText ?? null,
      storageKey: data.storageKey ?? null,
      storageDriver: data.storageDriver ?? null,
    });
    return toModel(row);
  }

  async update(
    id: number,
    data: UpdateInput,
    userId: number,
  ): Promise<TaskAttachmentModel | null> {
    if (!(await this.findById(id, userId))) return null;
    const row = await this.db.orm.public.TaskAttachment.where({ id }).update({
      url: data.url,
      displayText: data.displayText,
    });
    return toModel(row!);
  }

  async delete(
    id: number,
    userId: number,
  ): Promise<TaskAttachmentModel | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;
    await this.db.orm.public.TaskAttachment.where({ id }).delete();
    return existing;
  }
}
