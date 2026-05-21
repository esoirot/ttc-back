import {
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from '@nestjs/graphql';

export enum RateType {
  HOURLY = 'HOURLY',
  PER_WORD = 'PER_WORD',
  FIXED = 'FIXED',
}

registerEnumType(RateType, { name: 'RateType' });

@ObjectType()
export class Rate {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => RateType)
  type!: RateType;

  @Field()
  name!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
