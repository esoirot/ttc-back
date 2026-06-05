import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { TranslationRateType } from '../entities/translation-rate.entity';

@InputType()
export class CreateTranslationRateInput {
  @Field(() => TranslationRateType)
  type!: TranslationRateType;

  @Field(() => Int, { nullable: true })
  activityId?: number | null;

  @Field(() => Int, { nullable: true })
  clientId?: number;

  @Field()
  name!: string;

  @Field(() => Float)
  amount!: number;

  @Field({ defaultValue: 'EUR' })
  currency!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  sourceLanguage?: string;

  @Field({ nullable: true })
  targetLanguage?: string;
}
