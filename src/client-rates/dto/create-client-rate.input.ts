import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { RateType } from '../../generated/prisma/client';

@InputType()
export class CreateClientRateInput {
  @Field(() => Int)
  clientId!: number;

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
