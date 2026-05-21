import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Invoice } from '../entities/invoice.entity';

@ObjectType()
export class InvoiceConnection {
  @Field(() => [Invoice]) items!: Invoice[];
  @Field(() => Int, { nullable: true }) nextCursor!: number | null;
  @Field(() => Int) total!: number;
}
