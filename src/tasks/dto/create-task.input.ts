import { InputType, Field, Int } from '@nestjs/graphql';
import { TaskStatus } from '../entities/task.entity';

@InputType()
export class CreateTaskInput {
  @Field(() => Int)
  projectId!: number;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TaskStatus, { nullable: true })
  status?: TaskStatus;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  recurring?: string;

  @Field({ nullable: true })
  reminderOffset?: string;

  @Field(() => Int, { nullable: true })
  wordCount?: number | null;

  /** Hex colour shown on the task's row; empty clears it. */
  @Field(() => String, { nullable: true })
  color?: string | null;
}
