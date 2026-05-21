import { CreateCommentInput } from '../dto/create-comment.input';
import { UpdateCommentInput } from '../dto/update-comment.input';

export type TaskCommentModel = {
  id: number;
  taskId: number;
  authorId: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class CommentRepository {
  abstract findByTask(taskId: number): Promise<TaskCommentModel[]>;
  abstract create(
    data: CreateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel>;
  abstract update(
    id: number,
    data: UpdateCommentInput,
    authorId: number,
  ): Promise<TaskCommentModel>;
  abstract delete(id: number, authorId: number): Promise<TaskCommentModel>;
}
