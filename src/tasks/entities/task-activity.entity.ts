import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class TaskActivityUser {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string | null;
}

@ObjectType()
class TaskActivityTaskRef {
  @Field(() => Int)
  id!: number;

  @Field()
  title!: string;
}

@ObjectType()
export class TaskActivity {
  @Field(() => Int)
  id!: number;

  @Field(() => Int, { nullable: true })
  taskId?: number | null;

  @Field(() => Int, { nullable: true })
  timeEntryId?: number | null;

  @Field(() => Int)
  userId!: number;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  payload?: string | null;

  @Field()
  createdAt!: Date;

  @Field(() => TaskActivityUser, { nullable: true })
  user?: TaskActivityUser | null;

  /** Filled by projectActivities, to group a project's history by task. */
  @Field(() => TaskActivityTaskRef, { nullable: true })
  task?: TaskActivityTaskRef | null;
}

@ObjectType()
export class TaskActivityConnection {
  @Field(() => [TaskActivity]) items!: TaskActivity[];
  @Field(() => Int, { nullable: true }) nextCursor!: number | null;
  @Field(() => Int) total!: number;
}
