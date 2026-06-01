import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { TimerEventsService } from '../timer-events/timer-events.service';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeEntryConnection } from './types/time-entry-connection.type';
import { CreateTimeEntryInput } from './dto/create-time-entry.input';
import { StartTimerInput } from './dto/start-timer.input';
import { UpdateTimeEntryInput } from './dto/update-time-entry.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';

type RequestUser = { id: number };

@Resolver(() => TimeEntry)
export class TimeEntriesResolver {
  private readonly logger = new Logger(TimeEntriesResolver.name);

  constructor(
    private readonly timeEntriesService: TimeEntriesService,
    private readonly timerEventsService: TimerEventsService,
  ) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => TimeEntryConnection, { name: 'timeEntries' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Args('projectId', { type: () => Int, nullable: true }) projectId?: number,
    @Args('projectIds', { type: () => [Int], nullable: true })
    projectIds?: number[],
    @Args('start', { nullable: true }) start?: Date,
    @Args('end', { nullable: true }) end?: Date,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.timeEntriesService.findAll(
      user.id,
      { projectId, projectIds, start, end },
      pagination,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => TimeEntry, { name: 'activeTimer', nullable: true })
  activeTimer(@CurrentUser() user: RequestUser) {
    return this.timeEntriesService.findActive(user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TimeEntry)
  createTimeEntry(
    @Args('input') input: CreateTimeEntryInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.timeEntriesService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TimeEntry)
  async startTimer(
    @Args('input') input: StartTimerInput,
    @CurrentUser() user: RequestUser,
  ) {
    const entry = await this.timeEntriesService.startTimer(user.id, input);
    void this.timerEventsService
      .publish(user.id, entry)
      .catch((err: unknown) =>
        this.logger.warn(`SSE publish failed user=${user.id.toString()}`, err),
      );
    return entry;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TimeEntry)
  async stopTimer(@CurrentUser() user: RequestUser) {
    const entry = await this.timeEntriesService.stopTimer(user.id);
    void this.timerEventsService
      .publish(user.id, null)
      .catch((err: unknown) =>
        this.logger.warn(`SSE publish failed user=${user.id.toString()}`, err),
      );
    return entry;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TimeEntry)
  updateTimeEntry(
    @Args('input') input: UpdateTimeEntryInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.timeEntriesService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteTimeEntry(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.timeEntriesService.delete(id, user.id);
  }
}
