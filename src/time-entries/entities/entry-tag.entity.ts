import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class EntryTag {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;
}
