import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { IRateBase } from '../../common/interfaces/rate-base.interface';

export enum TranslationRateType {
  HOURLY = 'HOURLY',
  DAY = 'DAY',
  PER_WORD = 'PER_WORD',
  FIXED = 'FIXED',
}

registerEnumType(TranslationRateType, { name: 'TranslationRateType' });

@ObjectType({ implements: IRateBase })
export class TranslationRate extends IRateBase {
  @Field(() => TranslationRateType)
  type!: TranslationRateType;

  @Field(() => String, { nullable: true })
  sourceLanguage?: string | null;

  @Field(() => String, { nullable: true })
  targetLanguage?: string | null;
}
