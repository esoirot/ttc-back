import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { ClientType, ClientIndustry } from '../entities/client.entity';

@InputType()
export class CreateClientInput {
  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  legalName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  country?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  vatNumber?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  hubspotId?: string;

  @Field(() => ClientType, { nullable: true })
  clientType?: ClientType;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => Int, { nullable: true })
  paymentDelayDays?: number;

  @Field(() => Float, { nullable: true })
  taxRate?: number;

  @Field(() => Boolean, { nullable: true })
  billingEndOfMonth?: boolean;

  @Field(() => String, { nullable: true })
  website?: string;

  @Field(() => ClientIndustry, { nullable: true })
  industry?: ClientIndustry;

  @Field(() => [Int], { nullable: true })
  tagIds?: number[];
}
