import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { RateType } from '../../rates/entities/rate.entity';

@ObjectType()
export class ClientRate {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  clientId!: number;

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
