import { InputType, Field, Int } from '@nestjs/graphql';
import { InvoiceStatus } from '../entities/invoice.entity';

@InputType()
export class UpdateInvoiceInput {
  @Field(() => Int)
  id!: number;

  @Field(() => InvoiceStatus, { nullable: true })
  status?: InvoiceStatus;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Int, { nullable: true })
  clientId?: number;
}
