import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class MatchRatesInput {
  @Field(() => Int)
  perfectMatch!: number;

  @Field(() => Int)
  cm!: number;

  @Field(() => Int)
  repetitions!: number;

  @Field(() => Int)
  repetitionsBetweenFiles!: number;

  @Field(() => Int)
  match100!: number;

  @Field(() => Int)
  match95_99!: number;

  @Field(() => Int)
  match85_94!: number;

  @Field(() => Int)
  match75_84!: number;

  @Field(() => Int)
  match50_74!: number;

  @Field(() => Int)
  referenceAdaptativeMT!: number;

  @Field(() => Int)
  adaptativeMTWithLearning!: number;

  @Field(() => Int)
  newWordsTA!: number;
}

@InputType()
export class CreateRateSheetInput {
  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  sourceLanguage!: string;

  @Field()
  targetLanguage!: string;

  @Field({ defaultValue: 'EUR' })
  currency!: string;

  @Field(() => Float)
  pricePerWord!: number;

  @Field(() => MatchRatesInput)
  matchRates!: MatchRatesInput;
}
