import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class VerifyTwoFactorBackupInput {
  @Field()
  tempToken!: string;

  @Field()
  backupCode!: string;
}
