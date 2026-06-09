import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class TaskAttachment {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  taskId!: number;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  fileName?: string | null;

  @Field()
  url!: string;

  @Field(() => String, { nullable: true })
  displayText?: string | null;

  @Field()
  createdAt!: Date;
}
