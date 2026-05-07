import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteProjectResponse {
  @Field(() => Int)
  id!: number;
}
