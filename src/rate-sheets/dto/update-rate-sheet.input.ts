import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { MatchRatesInput } from './create-rate-sheet.input';

@InputType()
export class UpdateRateSheetInput {
  @Field(() => Int)
  id!: number;

  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  sourceLanguage?: string;

  @Field({ nullable: true })
  targetLanguage?: string;

  @Field({ nullable: true })
  currency?: string;

  @Field(() => Float, { nullable: true })
  pricePerWord?: number;

  @Field(() => MatchRatesInput, { nullable: true })
  matchRates?: MatchRatesInput;
}
