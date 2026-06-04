import { InterfaceType, Field, Int, Float } from '@nestjs/graphql';

@InterfaceType('IRateBase')
export abstract class IRateBase {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field()
  name!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
