import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Task } from '../entities/task.entity';

@ObjectType()
export class TaskConnection {
  @Field(() => [Task]) items!: Task[];
  @Field(() => Int, { nullable: true }) nextCursor!: number | null;
  @Field(() => Int) total!: number;
}
