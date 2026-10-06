import {
  ObjectType,
  InterfaceType,
  Field,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import { TranslationRate } from '../../translation-rates/entities/translation-rate.entity';

export enum ChargeType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}
registerEnumType(ChargeType, { name: 'ChargeType' });

export enum OccupationType {
  TRANSLATOR = 'TRANSLATOR',
  CORRECTOR = 'CORRECTOR',
  CUSTOM = 'CUSTOM',
}
registerEnumType(OccupationType, { name: 'OccupationType' });

@ObjectType()
export class Charge {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  occupationId!: number;

  @Field()
  name!: string;

  @Field(() => Int)
  amount!: number;

  @Field(() => ChargeType)
  type!: ChargeType;
}

@ObjectType()
class LanguagePair {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  occupationId!: number;

  @Field()
  fromLanguage!: string;

  @Field()
  toLanguage!: string;
}

@ObjectType()
class CustomField {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  occupationId!: number;

  @Field()
  key!: string;

  @Field()
  value!: string;
}

@InterfaceType({
  resolveType(value: { occupationType: OccupationType }) {
    if (value.occupationType === OccupationType.TRANSLATOR)
      return TranslatorOccupation;
    if (value.occupationType === OccupationType.CORRECTOR)
      return CorrectorOccupation;
    return CustomOccupation;
  },
})
export abstract class Occupation {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  name!: string;

  @Field(() => OccupationType)
  occupationType!: OccupationType;

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

  @Field(() => [Charge])
  charges!: Charge[];

  @Field(() => [TranslationRate])
  translationRates!: TranslationRate[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType({ implements: () => [Occupation] })
export class TranslatorOccupation extends Occupation {
  @Field(() => [LanguagePair])
  languagePairs!: LanguagePair[];
}

@ObjectType({ implements: () => [Occupation] })
export class CorrectorOccupation extends Occupation {}

@ObjectType({ implements: () => [Occupation] })
export class CustomOccupation extends Occupation {
  @Field(() => [CustomField])
  customFields!: CustomField[];
}
