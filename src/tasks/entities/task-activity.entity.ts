import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class TaskActivityUser {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string | null;
}

@ObjectType()
export class TaskActivity {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  taskId!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  payload?: string | null;

  @Field()
  createdAt!: Date;

  @Field(() => TaskActivityUser, { nullable: true })
  user?: TaskActivityUser | null;
}
