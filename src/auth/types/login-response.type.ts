import { ObjectType, Field } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class LoginResponse {
  @Field(() => User, { nullable: true })
  user?: User;

  @Field({ nullable: true })
  requiresTwoFactor?: boolean;

  @Field({ nullable: true })
  tempToken?: string;
}
