import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

registerEnumType(InvoiceStatus, { name: 'InvoiceStatus' });

@ObjectType()
export class Invoice {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field()
  number!: string;

  @Field(() => InvoiceStatus)
  status!: InvoiceStatus;

  @Field()
  currency!: string;

  @Field(() => Date, { nullable: true })
  issuedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  dueDate?: Date | null;

  @Field(() => Date, { nullable: true })
  paidAt?: Date | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => [InvoiceItem], { nullable: true })
  items?: InvoiceItem[];
}
