import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class GenerateInvoiceInput {
  @Field(() => Int)
  projectId!: number;

  @Field(() => Int, { nullable: true })
  clientId?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  dueDate?: Date;
}
