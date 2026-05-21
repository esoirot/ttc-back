import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateTimeEntryInput {
  @Field(() => Int)
  id!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number;

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
}
