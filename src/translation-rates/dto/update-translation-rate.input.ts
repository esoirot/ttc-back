import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { TranslationRateType } from '../entities/translation-rate.entity';

@InputType()
export class UpdateTranslationRateInput {
  @Field(() => Int)
  id!: number;

  @Field(() => TranslationRateType, { nullable: true })
  type?: TranslationRateType;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  clientId?: number;

  @Field({ nullable: true })
  sourceLanguage?: string;

  @Field({ nullable: true })
  targetLanguage?: string;
}
