import { InputType, Field } from '@nestjs/graphql';

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
}
