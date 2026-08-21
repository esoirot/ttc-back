import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateTimeEntryInput {
  @Field(() => Int)
  id!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number;

  @Field(() => Int, { nullable: true })
  taskId?: number | null;

  @Field(() => Int, { nullable: true })
  subtaskId?: number | null;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  startTime?: Date;

  @Field({ nullable: true })
  endTime?: Date;

  @Field({ nullable: true })
  billable?: boolean;

  @Field({ nullable: true })
  clockifyEntryId?: string;

  @Field(() => [Int], { nullable: true })
  tagIds?: number[];

  @Field(() => Int, { nullable: true })
  activityId?: number | null;

  @Field(() => Int, { nullable: true })
  wordsProcessed?: number | null;
}
