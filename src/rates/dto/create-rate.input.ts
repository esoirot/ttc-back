import { InputType, Field, Float } from '@nestjs/graphql';
import { RateType } from '../entities/rate.entity';

@InputType()
export class CreateRateInput {
  @Field(() => RateType)
  type!: RateType;

  @Field()
  name!: string;

  @Field(() => Float)
  amount!: number;

  @Field({ defaultValue: 'EUR' })
  currency!: string;

  @Field({ nullable: true })
  description?: string;
}
