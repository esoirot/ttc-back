import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateTagInput {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;
}
