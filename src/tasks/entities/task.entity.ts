import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { Subtask } from './subtask.entity';
import { TaskComment } from './task-comment.entity';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

registerEnumType(TaskStatus, { name: 'TaskStatus' });

@ObjectType()
export class Task {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  projectId!: number;

  @Field(() => Int, { nullable: true })
  assigneeId?: number | null;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => TaskStatus)
  status!: TaskStatus;

  @Field(() => Date, { nullable: true })
  dueDate?: Date | null;

  @Field(() => Int)
  sortOrder!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => [Subtask])
  subtasks!: Subtask[];

  @Field(() => [TaskComment])
  comments!: TaskComment[];
}
