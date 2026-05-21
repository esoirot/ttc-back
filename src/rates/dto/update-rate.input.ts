import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { RateType } from '../entities/rate.entity';

@InputType()
export class UpdateRateInput {
  @Field(() => Int)
  id!: number;

  @Field(() => RateType, { nullable: true })
  type?: RateType;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  description?: string;
}
