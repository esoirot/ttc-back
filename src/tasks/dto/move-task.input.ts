import { Field, InputType, Int } from '@nestjs/graphql';
import { TaskStatus } from '../entities/task.entity';

@InputType()
export class MoveTaskInput {
  @Field(() => Int)
  id!: number;

  @Field(() => TaskStatus)
  status!: TaskStatus;

  /** 0-based place in the column; clamped to the column's bounds. */
  @Field(() => Int)
  position!: number;
}
