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

  @Field({ nullable: true })
  logoUrl?: string;

  @Field(() => [String])
  adminPermissions!: string[];

  @Field()
  defaultCurrency!: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  mobilePhone?: string | null;

  @Field(() => String, { nullable: true })
  jobTitle?: string | null;

  @Field(() => String, { nullable: true })
  interfaceLanguage?: string | null;

  @Field(() => String, { nullable: true })
  dateFormat?: string | null;

  @Field(() => String, { nullable: true })
  hourFormat?: string | null;

  @Field(() => String, { nullable: true })
  numberFormat?: string | null;

  @Field()
  createdAt!: Date;

  @Field(() => [Project], { nullable: true })
  projects?: Project[];
}
