import { ResolveField, Resolver, Parent, Int } from '@nestjs/graphql';
import { TimeEntriesService } from './time-entries.service';
import { Task } from '../tasks/entities/task.entity';

@Resolver(() => Task)
export class TaskTimeResolver {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @ResolveField(() => Int, { nullable: true })
  totalTimeSeconds(@Parent() task: { id: number }): Promise<number | null> {
    return this.timeEntriesService.getTotalDuration(task.id);
  }
}
