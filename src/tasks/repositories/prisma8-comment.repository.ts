import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { taskVisibleTo } from '../../prisma8/access';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, toDb } from '../../prisma8/timestamp';
import { CreateCommentInput } from '../dto/create-comment.input';
import { UpdateCommentInput } from '../dto/update-comment.input';
import { CommentRepository, TaskCommentModel } from './comment.repository';

type Row = Omit<TaskCommentModel, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

function toModel(row: Row): TaskCommentModel {
  return {
    ...row,
    createdAt: fromDb(row.createdAt),
    updatedAt: fromDb(row.updatedAt),
  };
}

@Injectable()
export class Prisma8CommentRepository implements CommentRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get comments() {
    return this.db.orm.public.TaskComment;
  }

  async findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<TaskCommentModel[]> {
    const rows = await this.comments
      .where((c) => c.taskId.in(taskIds))
      .where((c) => c.task.some(taskVisibleTo(userId)))
      .orderBy((c) => c.createdAt.asc())
      .all();
    return rows.map(toModel);
  }

  async create(
    data: CreateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    const row = await this.comments.create({
      taskId: data.taskId,
      authorId,
      body: data.body,
      updatedAt: toDb(new Date()),
    });
    return toModel(row);
  }

  private async ownComment(id: number, authorId: number) {
    const existing = await this.comments.first({ id });
    if (!existing) throw new NotFoundException(`Comment ${id} not found`);
    if (existing.authorId !== authorId) throw new ForbiddenException();
    return existing;
  }

  async update(
    id: number,
    data: UpdateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    await this.ownComment(id, authorId);
    const row = await this.comments
      .where({ id })
      .update({ body: data.body, updatedAt: toDb(new Date()) });
    return toModel(row!);
  }

  async delete(id: number, authorId: number): Promise<TaskCommentModel> {
    const existing = await this.ownComment(id, authorId);
    await this.comments.where({ id }).delete();
    return toModel(existing);
  }
}
