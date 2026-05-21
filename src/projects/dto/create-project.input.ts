import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { ProjectStatus } from '../entities/project.entity';

@InputType()
export class CreateProjectInput {
  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  clientId?: number;

  @Field(() => ProjectStatus, { nullable: true })
  status?: ProjectStatus;

  @Field({ nullable: true })
  sourceLanguage?: string;

  @Field({ nullable: true })
  targetLanguage?: string;

  @Field(() => Int, { nullable: true })
  wordCount?: number;

  @Field(() => Float, { nullable: true })
  unitPrice?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  deadline?: Date;

  @Field({ nullable: true })
  startDate?: Date;
}
