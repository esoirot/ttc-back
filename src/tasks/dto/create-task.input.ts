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

  @Field(() => Int, { nullable: true })
  assigneeId?: number;

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
}
