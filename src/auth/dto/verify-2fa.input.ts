import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class VerifyTwoFactorInput {
  @Field()
  tempToken!: string;

  @Field()
  code!: string;
}
