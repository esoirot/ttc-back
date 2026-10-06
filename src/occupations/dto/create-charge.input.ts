import { InputType, Field, Int } from '@nestjs/graphql';
import { ChargeType } from '../entities/occupation.entity';

@InputType()
export class CreateChargeInput {
  @Field(() => Int)
  occupationId!: number;

  @Field()
  name!: string;

  @Field(() => Int)
  amount!: number;

  @Field(() => ChargeType)
  type!: ChargeType;
}
