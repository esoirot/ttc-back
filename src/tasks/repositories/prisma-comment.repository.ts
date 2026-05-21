import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CommentRepository, TaskCommentModel } from './comment.repository';
import { CreateCommentInput } from '../dto/create-comment.input';
import { UpdateCommentInput } from '../dto/update-comment.input';

@Injectable()
export class PrismaCommentRepository implements CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: number): Promise<TaskCommentModel[]> {
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(
    data: CreateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    return this.prisma.taskComment.create({
      data: { taskId: data.taskId, authorId, body: data.body },
    });
  }

  async update(
    id: number,
    data: UpdateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    const existing = await this.prisma.taskComment.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Comment ${id} not found`);
    if (existing.authorId !== authorId) throw new ForbiddenException();
    return this.prisma.taskComment.update({
      where: { id },
      data: { body: data.body },
    });
  }

  async delete(id: number, authorId: number): Promise<TaskCommentModel> {
    const existing = await this.prisma.taskComment.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Comment ${id} not found`);
    if (existing.authorId !== authorId) throw new ForbiddenException();
    return this.prisma.taskComment.delete({ where: { id } });
  }
}
