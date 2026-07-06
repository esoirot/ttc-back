import { CreateUserInput } from './create-user.input';
import { InputType, Field, PartialType, Int } from '@nestjs/graphql';
import { Role, AdminPermission } from '../entities/user.entity';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @Field(() => Int)
  id!: number;

  @Field(() => Role, { nullable: true })
  role?: Role;

  @Field(() => [AdminPermission], { nullable: true })
  adminPermissions?: string[];
}
