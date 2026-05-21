import { ObjectType, Field, Int } from '@nestjs/graphql';
import { TimeEntry } from '../entities/time-entry.entity';

@ObjectType()
export class TimeEntryConnection {
  @Field(() => [TimeEntry]) items!: TimeEntry[];
  @Field(() => Int, { nullable: true }) nextCursor!: number | null;
  @Field(() => Int) total!: number;
}
