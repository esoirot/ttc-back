import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteUserResponse {
  @Field(() => Int)
  id!: number;
}
