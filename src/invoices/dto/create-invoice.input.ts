import { InputType, Field, Int, Float } from '@nestjs/graphql';

@InputType()
export class AddInvoiceItemInput {
  @Field(() => Int)
  invoiceId!: number;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number;

  @Field(() => Int, { nullable: true })
  timeEntryId?: number;
}

@InputType()
export class UpdateInvoiceItemInput {
  @Field(() => Int)
  id!: number;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  quantity?: number;

  @Field(() => Float, { nullable: true })
  unitPrice?: number;
}

@InputType()
export class CreateInvoiceInput {
  @Field(() => Int, { nullable: true })
  clientId?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  notes?: string;
}
