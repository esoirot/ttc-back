import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ClientStatus } from '../../clients/entities/client.entity';

@ObjectType()
class DashboardDeadline {
  @Field(() => Int) id!: number;
  @Field() title!: string;
  @Field() deadline!: string;
  @Field() status!: string;
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
}

@ObjectType()
export class DashboardData {
  @Field(() => Int) activeProjectCount!: number;
  @Field(() => Int) unpaidInvoiceCount!: number;
  @Field(() => Int) monthToDateSeconds!: number;
  @Field(() => Float) monthToDateRevenue!: number;
  @Field(() => [DashboardDeadline]) upcomingDeadlines!: DashboardDeadline[];
  @Field(() => [DashboardTimeEntry]) recentTimeEntries!: DashboardTimeEntry[];
  @Field(() => [DashboardProspect]) prospectsToContact!: DashboardProspect[];
}
