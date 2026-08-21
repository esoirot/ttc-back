import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateTimeEntryInput {
  @Field(() => Int, { nullable: true })
  projectId?: number;

  @Field(() => Int, { nullable: true })
  taskId?: number;

  @Field(() => Int, { nullable: true })
  subtaskId?: number;

  @Field({ nullable: true })
  description?: string;

  @Field()
  startTime!: Date;

  @Field()
  endTime!: Date;

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
