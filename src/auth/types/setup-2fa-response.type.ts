import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class SetupTwoFactorResponse {
  @Field()
  qrCodeUrl!: string;

  @Field()
  secret!: string;
}
