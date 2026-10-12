import { ResolveField, Resolver, Parent, Int, Context } from '@nestjs/graphql';
import { Task } from '../tasks/entities/task.entity';
import type { GqlContext } from '../auth/types/gql-context.type';

@Resolver(() => Task)
export class TaskTimeResolver {
  @ResolveField(() => Int, { nullable: true })
  totalTimeSeconds(
    @Parent() task: { id: number },
    @Context() ctx: GqlContext,
  ): Promise<number | null> {
    return ctx.loaders.totalSecondsByTask.load(task.id);
  }
}
