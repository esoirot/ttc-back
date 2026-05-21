import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateCompanyContactInput {
  @Field(() => Int)
  clientId!: number;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;
}
