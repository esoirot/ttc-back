import { CreateUserInput } from './create-user.input';
import { InputType, Field, PartialType, Int } from '@nestjs/graphql';
import { Role } from '../entities/user.entity';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @Field(() => Int)
  id!: number;

  @Field(() => Role, { nullable: true })
  role?: Role;

  @Field(() => [String], { nullable: true })
  adminPermissions?: string[];
}
