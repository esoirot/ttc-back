import { InputType, Field, Int } from '@nestjs/graphql';
import { LanguagePairInput } from './language-pair.input';

@InputType()
export class UpdateActivityInput {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  companyName?: string | null;

  @Field(() => String, { nullable: true })
  legalForm?: string | null;

  @Field(() => String, { nullable: true })
  professionalEmail?: string | null;

  @Field(() => String, { nullable: true })
  professionalPhone?: string | null;

  @Field(() => String, { nullable: true })
  website?: string | null;

  @Field(() => String, { nullable: true })
  timezone?: string | null;

  @Field(() => Int, { nullable: true })
  objectiveQ1?: number | null;

  @Field(() => Int, { nullable: true })
  objectiveQ2?: number | null;

  @Field(() => Int, { nullable: true })
  objectiveQ3?: number | null;

  @Field(() => Int, { nullable: true })
  objectiveQ4?: number | null;

  @Field(() => [LanguagePairInput], { nullable: true })
  languagePairs?: LanguagePairInput[] | null;
}
