import {
  ObjectType,
  InterfaceType,
  Field,
  Int,
  registerEnumType,
} from '@nestjs/graphql';

export enum ChargeType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}
registerEnumType(ChargeType, { name: 'ChargeType' });

export enum ActivityType {
  TRANSLATOR = 'TRANSLATOR',
  CORRECTOR = 'CORRECTOR',
  CUSTOM = 'CUSTOM',
}
registerEnumType(ActivityType, { name: 'ActivityType' });

@ObjectType()
export class Charge {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  activityId!: number;

  @Field()
  name!: string;

  @Field(() => Int)
  amount!: number;

  @Field(() => ChargeType)
  type!: ChargeType;
}

@ObjectType()
export class LanguagePair {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  activityId!: number;

  @Field()
  fromLanguage!: string;

  @Field()
  toLanguage!: string;
}

@ObjectType()
export class CustomField {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  activityId!: number;

  @Field()
  key!: string;

  @Field()
  value!: string;
}

@InterfaceType({
  resolveType(value: { activityType: ActivityType }) {
    if (value.activityType === ActivityType.TRANSLATOR)
      return TranslatorActivity;
    if (value.activityType === ActivityType.CORRECTOR) return CorrectorActivity;
    return CustomActivity;
  },
})
export abstract class Activity {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  name!: string;

  @Field(() => ActivityType)
  activityType!: ActivityType;

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

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType({ implements: () => [Activity] })
export class TranslatorActivity extends Activity {
  @Field(() => [LanguagePair])
  languagePairs!: LanguagePair[];
}

@ObjectType({ implements: () => [Activity] })
export class CorrectorActivity extends Activity {}

@ObjectType({ implements: () => [Activity] })
export class CustomActivity extends Activity {
  @Field(() => [CustomField])
  customFields!: CustomField[];
}
