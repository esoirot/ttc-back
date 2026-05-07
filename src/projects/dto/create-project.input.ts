import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateProjectInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  userId?: number;
}
