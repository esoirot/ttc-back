import { InputType, Field, Int } from '@nestjs/graphql';
import { ChargeType } from '../entities/activity.entity';

@InputType()
export class CreateChargeInput {
  @Field(() => Int)
  activityId!: number;

  @Field()
  name!: string;

  @Field(() => Int)
  amount!: number;

  @Field(() => ChargeType)
  type!: ChargeType;
}
