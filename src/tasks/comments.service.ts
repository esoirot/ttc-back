import { Injectable } from '@nestjs/common';
import {
  CommentRepository,
  TaskCommentModel,
} from './repositories/comment.repository';
import { ActivitiesService } from './activities.service';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';

@Injectable()
export class CommentsService {
  constructor(
    private readonly repo: CommentRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  findByTask(taskId: number): Promise<TaskCommentModel[]> {
    return this.repo.findByTask(taskId);
  }

  async create(
    input: CreateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    const comment = await this.repo.create(input, authorId);
    await this.activitiesService.log(input.taskId, authorId, 'COMMENT_ADDED');
    return comment;
  }

  async update(
    id: number,
    input: UpdateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel> {
    const comment = await this.repo.update(id, input, authorId);
    await this.activitiesService.log(
      comment.taskId,
      authorId,
      'COMMENT_EDITED',
    );
    return comment;
  }

  async delete(id: number, authorId: number): Promise<boolean> {
    const comment = await this.repo.delete(id, authorId);
    await this.activitiesService.log(
      comment.taskId,
      authorId,
      'COMMENT_DELETED',
    );
    return true;
  }
}
