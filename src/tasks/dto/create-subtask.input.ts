import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateSubtaskInput {
  @Field(() => Int)
  taskId!: number;

  @Field()
  title!: string;
}
