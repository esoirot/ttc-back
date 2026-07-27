import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class ClientStatusHistoryUser {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string | null;
}

@ObjectType()
export class ClientStatusHistory {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  clientId!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  payload?: string | null;

  @Field()
  createdAt!: Date;

  @Field(() => ClientStatusHistoryUser, { nullable: true })
  user?: ClientStatusHistoryUser | null;
}
