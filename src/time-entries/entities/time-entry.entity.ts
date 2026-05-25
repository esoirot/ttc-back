import { ObjectType, Field, Int } from '@nestjs/graphql';
import { EntryTag } from './entry-tag.entity';

@ObjectType()
export class TimeEntry {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number | null;

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
}
