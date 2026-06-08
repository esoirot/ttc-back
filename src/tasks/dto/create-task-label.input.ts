import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateTaskLabelInput {
  @Field(() => Int)
  taskId!: number;

  @Field()
  name!: string;

  @Field({ nullable: true })
  color?: string;
}
