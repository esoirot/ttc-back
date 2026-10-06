import { InputType, Field } from '@nestjs/graphql';
import { OccupationType } from '../entities/occupation.entity';
import { LanguagePairInput } from './language-pair.input';
import { CustomFieldInput } from './custom-field.input';

@InputType()
export class CreateOccupationInput {
  @Field()
  name!: string;

  @Field(() => OccupationType, { nullable: true })
  occupationType?: OccupationType | null;

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

  @Field(() => [LanguagePairInput], { nullable: true })
  languagePairs?: LanguagePairInput[] | null;

  @Field(() => [CustomFieldInput], { nullable: true })
  customFields?: CustomFieldInput[] | null;
}
