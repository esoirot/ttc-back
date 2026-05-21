import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Project } from '../entities/project.entity';

@ObjectType()
export class ProjectConnection {
  @Field(() => [Project]) items!: Project[];
  @Field(() => Int, { nullable: true }) nextCursor!: number | null;
  @Field(() => Int) total!: number;
}
