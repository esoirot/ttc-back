import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class StartTimerInput {
  @Field(() => Int, { nullable: true })
  projectId?: number;

  @Field(() => Int, { nullable: true })
  taskId?: number;

  @Field(() => Int, { nullable: true })
  subtaskId?: number;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  billable?: boolean;

  @Field(() => [Int], { nullable: true })
  tagIds?: number[];
}
