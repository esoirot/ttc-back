import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Project {
  @Field(() => Int)
  id!: number;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  userId?: number;
}
