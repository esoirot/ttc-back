import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) cursor?: number;
}
