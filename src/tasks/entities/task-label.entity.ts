import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class TaskLabel {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  taskId!: number;

  @Field()
  name!: string;

  @Field()
  color!: string;

  @Field()
  createdAt!: Date;
}
