import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateTimeEntryInput {
  @Field(() => Int, { nullable: true })
  projectId?: number;

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
}
