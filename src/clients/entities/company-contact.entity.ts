import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class CompanyContact {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  clientId!: number;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
