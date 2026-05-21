import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Subtask {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  taskId!: number;

  @Field()
  title!: string;

  @Field()
  done!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
