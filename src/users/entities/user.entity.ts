import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { Project } from '../../projects/entities/project.entity';

export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

registerEnumType(Role, { name: 'Role' });

@ObjectType()
export class User {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Role)
  role!: Role;

  @Field()
  twoFactorEnabled!: boolean;

  @Field(() => [Project], { nullable: true })
  projects?: Project[];
}
