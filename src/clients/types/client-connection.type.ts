import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Client } from '../entities/client.entity';

@ObjectType()
export class ClientConnection {
  @Field(() => [Client]) items!: Client[];
  @Field(() => Int, { nullable: true }) nextCursor!: number | null;
  @Field(() => Int) total!: number;
}
