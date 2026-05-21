import {
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from '@nestjs/graphql';

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(ProjectStatus, { name: 'ProjectStatus' });

@ObjectType()
export class Project {
  @Field(() => Int)
  id!: number;

  @Field(() => Int, { nullable: true })
  userId?: number | null;

  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ProjectStatus)
  status!: ProjectStatus;

  @Field(() => String, { nullable: true })
  sourceLanguage?: string | null;

  @Field(() => String, { nullable: true })
  targetLanguage?: string | null;

  @Field(() => Int, { nullable: true })
  wordCount?: number | null;

  @Field(() => Float, { nullable: true })
  unitPrice?: number | null;

  @Field(() => String)
  currency!: string;

  @Field(() => Date, { nullable: true })
  deadline?: Date | null;

  @Field(() => Date, { nullable: true })
  startDate?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
