import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateMeInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  logoUrl?: string;

  @Field({ nullable: true })
  defaultCurrency?: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  mobilePhone?: string | null;

  @Field(() => String, { nullable: true })
  jobTitle?: string | null;

  @Field(() => String, { nullable: true })
  interfaceLanguage?: string | null;

  @Field(() => String, { nullable: true })
  dateFormat?: string | null;

  @Field(() => String, { nullable: true })
  hourFormat?: string | null;

  @Field(() => String, { nullable: true })
  numberFormat?: string | null;
}
