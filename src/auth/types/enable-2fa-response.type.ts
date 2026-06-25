import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class EnableTwoFactorResponse {
  @Field(() => [String])
  backupCodes!: string[];
}
