import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class InvoiceItem {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  invoiceId!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number | null;

  @Field(() => Int, { nullable: true })
  timeEntryId?: number | null;

  @Field()
  description!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  total!: number;
}
