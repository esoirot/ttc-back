import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateUserInput {
  @Field(() => String)
  email!: string;

  @Field(() => String, { nullable: true })
  name?: string;
}
