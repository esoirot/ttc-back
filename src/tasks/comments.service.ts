import { Injectable } from '@nestjs/common';
import {
  CommentRepository,
  TaskCommentModel,
} from './repositories/comment.repository';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';

@Injectable()
export class CommentsService {
  constructor(private readonly repo: CommentRepository) {}

  findByTask(taskId: number): Promise<TaskCommentModel[]> {
    return this.repo.findByTask(taskId);
  }

  create(
    input: CreateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    return this.repo.create(input, authorId);
  }

  update(
    id: number,
    input: UpdateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    return this.repo.update(id, input, authorId);
  }

  async delete(id: number, authorId: number): Promise<boolean> {
    await this.repo.delete(id, authorId);
    return true;
  }
}
