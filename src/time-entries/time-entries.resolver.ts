import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Args,
  Int,
  Context,
} from '@nestjs/graphql';
import { UseGuards, Inject, ForbiddenException } from '@nestjs/common';
import type { PubSubEngine } from 'graphql-subscriptions';
import type { WsContext } from '../common/types/ws-context.type';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeEntryConnection } from './types/time-entry-connection.type';
import { CreateTimeEntryInput } from './dto/create-time-entry.input';
import { StartTimerInput } from './dto/start-timer.input';
import { UpdateTimeEntryInput } from './dto/update-time-entry.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';
import { PUB_SUB } from '../common/pubsub.module';

type RequestUser = { id: number };

const TIMER_CHANNEL = (userId: number) => `timer:${userId}`;

@Resolver(() => TimeEntry)
export class TimeEntriesResolver {
  constructor(
    private readonly timeEntriesService: TimeEntriesService,
    @Inject(PUB_SUB) private readonly pubSub: PubSubEngine,
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
    await this.pubSub.publish(TIMER_CHANNEL(user.id), { timerUpdated: entry });
    return entry;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TimeEntry)
  async stopTimer(@CurrentUser() user: RequestUser) {
    const entry = await this.timeEntriesService.stopTimer(user.id);
    await this.pubSub.publish(TIMER_CHANNEL(user.id), { timerUpdated: null });
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

  @Subscription(() => TimeEntry, {
    nullable: true,
    resolve(payload: { timerUpdated: Record<string, unknown> | null }) {
      const e = payload.timerUpdated;
      if (!e) return null;
      // Redis PubSub JSON round-trips Date→string; GraphQLISODateTime.serialize
      // only accepts Date instances, so reconstruct them before returning.
      return {
        ...e,
        startTime: new Date(e['startTime'] as string),
        endTime: e['endTime'] != null ? new Date(e['endTime'] as string) : null,
        createdAt: new Date(e['createdAt'] as string),
        updatedAt: new Date(e['updatedAt'] as string),
      };
    },
  })
  timerUpdated(
    @Args('userId', { type: () => Int }) userId: number,
    @Context() ctx: WsContext,
  ) {
    if (ctx.userId === undefined || ctx.userId !== userId) {
      throw new ForbiddenException(
        'Not authorized to subscribe to this channel',
      );
    }
    return this.pubSub.asyncIterableIterator(TIMER_CHANNEL(userId));
  }
}
