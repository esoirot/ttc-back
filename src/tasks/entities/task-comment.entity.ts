import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class TaskComment {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  taskId!: number;

  @Field(() => Int)
  authorId!: number;

  @Field()
  body!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
