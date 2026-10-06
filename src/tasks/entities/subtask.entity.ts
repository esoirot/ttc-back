import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Subtask {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  taskId!: number;

  @Field({ nullable: true })
  checklistTitle?: string;

  @Field()
  title!: string;

  @Field()
  done!: boolean;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => Int, { nullable: true })
  wordCount?: number | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
