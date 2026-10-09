import {
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { ClientStatus } from '../../clients/entities/client.entity';

enum DeadlineKind {
  PROJECT = 'PROJECT',
  TASK = 'TASK',
  CHECKLIST_ITEM = 'CHECKLIST_ITEM',
}

registerEnumType(DeadlineKind, { name: 'DeadlineKind' });

@ObjectType()
class DashboardDeadline {
  @Field(() => DeadlineKind) kind!: DeadlineKind;
  @Field(() => Int) id!: number;
  @Field() title!: string;
  @Field() deadline!: string;
  @Field(() => Int) projectId!: number;
  @Field() projectTitle!: string;
  @Field(() => Int, { nullable: true }) taskId!: number | null;
  @Field(() => String, { nullable: true }) taskTitle!: string | null;
}

@ObjectType()
class DashboardTimeEntry {
  @Field(() => Int) id!: number;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field() startTime!: string;
  @Field(() => Int, { nullable: true }) durationSeconds!: number | null;
}

@ObjectType()
class DashboardProspect {
  @Field(() => Int) id!: number;
  @Field() name!: string;
  @Field(() => ClientStatus) status!: ClientStatus;
  @Field(() => String, { nullable: true }) contactedAt!: string | null;
  @Field(() => String, { nullable: true }) dueAt!: string | null;
}

@ObjectType()
export class DashboardData {
  @Field(() => Int) activeProjectCount!: number;
  @Field(() => Int) unpaidInvoiceCount!: number;
  @Field(() => Int) monthToDateSeconds!: number;
  @Field(() => Float) monthToDateRevenue!: number;
  @Field(() => Int) yearToDateWords!: number;
  @Field(() => [DashboardDeadline]) upcomingDeadlines!: DashboardDeadline[];
  @Field(() => [DashboardTimeEntry]) recentTimeEntries!: DashboardTimeEntry[];
  @Field(() => [DashboardProspect]) prospectsToContact!: DashboardProspect[];
}
