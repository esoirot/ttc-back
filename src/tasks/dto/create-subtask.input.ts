import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateSubtaskInput {
  @Field(() => Int)
  taskId!: number;

  @Field({ nullable: true })
  checklistTitle?: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => Int, { nullable: true })
  wordCount?: number | null;
}
