import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class UpdateSubtaskInput {
  @Field(() => Int)
  id!: number;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  done?: boolean;
}
