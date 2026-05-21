import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubtasksService } from './subtasks.service';
import { CommentsService } from './comments.service';
import { Task } from './entities/task.entity';
import { Subtask } from './entities/subtask.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskConnection } from './types/task-connection.type';
import { CreateTaskInput } from './dto/create-task.input';
import { UpdateTaskInput } from './dto/update-task.input';
import { CreateSubtaskInput } from './dto/create-subtask.input';
import { UpdateSubtaskInput } from './dto/update-subtask.input';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';

type RequestUser = { id: number };

@Resolver(() => Task)
export class TasksResolver {
  constructor(
    private readonly tasksService: TasksService,
    private readonly subtasksService: SubtasksService,
    private readonly commentsService: CommentsService,
  ) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => Task, { name: 'task' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.tasksService.findOne(id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => TaskConnection, { name: 'tasks' })
  findByProject(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.tasksService.findByProject(projectId, pagination);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => TaskConnection, { name: 'myTasks' })
  findMyTasks(
    @CurrentUser() user: RequestUser,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.tasksService.findByAssignee(user.id, pagination);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Task)
  createTask(@Args('input') input: CreateTaskInput) {
    return this.tasksService.create(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Task)
  updateTask(@Args('input') input: UpdateTaskInput) {
    return this.tasksService.update(input.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteTask(@Args('id', { type: () => Int }) id: number) {
    return this.tasksService.delete(id);
  }

  @ResolveField(() => [Subtask])
  subtasks(@Parent() task: Task) {
    return this.subtasksService.findByTask(task.id);
  }

  @ResolveField(() => [TaskComment])
  comments(@Parent() task: Task) {
    return this.commentsService.findByTask(task.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Subtask)
  createSubtask(@Args('input') input: CreateSubtaskInput) {
    return this.subtasksService.create(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Subtask)
  updateSubtask(@Args('input') input: UpdateSubtaskInput) {
    return this.subtasksService.update(input.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteSubtask(@Args('id', { type: () => Int }) id: number) {
    return this.subtasksService.delete(id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TaskComment)
  createTaskComment(
    @CurrentUser() user: RequestUser,
    @Args('input') input: CreateCommentInput,
  ) {
    return this.commentsService.create(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TaskComment)
  updateTaskComment(
    @CurrentUser() user: RequestUser,
    @Args('input') input: UpdateCommentInput,
  ) {
    return this.commentsService.update(input.id, input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteTaskComment(
    @CurrentUser() user: RequestUser,
    @Args('id', { type: () => Int }) id: number,
  ) {
    return this.commentsService.delete(id, user.id);
  }
}
