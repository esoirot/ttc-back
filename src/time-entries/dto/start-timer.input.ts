import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class StartTimerInput {
  @Field(() => Int, { nullable: true })
  projectId?: number;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  billable?: boolean;
}
