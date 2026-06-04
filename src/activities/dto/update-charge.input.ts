import { InputType, Field, Int } from '@nestjs/graphql';
import { ChargeType } from '../entities/activity.entity';

@InputType()
export class UpdateChargeInput {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => Int, { nullable: true })
  amount?: number | null;

  @Field(() => ChargeType, { nullable: true })
  type?: ChargeType | null;
}
