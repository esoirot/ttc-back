import { ObjectType, Field, Int } from '@nestjs/graphql';
import { EntryTag } from './entry-tag.entity';
import { TaskActivity } from '../../tasks/entities/task-activity.entity';

@ObjectType()
class TimeEntryTaskRef {
  @Field(() => Int)
  id!: number;

  @Field(() => String)
  title!: string;
}

@ObjectType()
class TimeEntrySubtaskRef {
  @Field(() => Int)
  id!: number;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  checklistTitle?: string | null;
}

@ObjectType()
export class TimeEntry {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number | null;

  @Field(() => Int, { nullable: true })
  taskId?: number | null;

  @Field(() => TimeEntryTaskRef, { nullable: true })
  task?: TimeEntryTaskRef | null;

  @Field(() => Int, { nullable: true })
  subtaskId?: number | null;

  @Field(() => TimeEntrySubtaskRef, { nullable: true })
  subtask?: TimeEntrySubtaskRef | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Date)
  startTime!: Date;

  @Field(() => Date, { nullable: true })
  endTime?: Date | null;

  @Field(() => Int, { nullable: true })
  durationSeconds?: number | null;

  @Field()
  billable!: boolean;

  @Field(() => String, { nullable: true })
  clockifyEntryId?: string | null;

  @Field(() => [EntryTag])
  tags!: EntryTag[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => [TaskActivity])
  activities?: TaskActivity[];
}
