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
import { LabelsService } from './labels.service';
import { ActivitiesService } from './activities.service';
import { AttachmentsService } from './attachments.service';
import { Task } from './entities/task.entity';
import { Subtask } from './entities/subtask.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskLabel } from './entities/task-label.entity';
import { TaskActivity } from './entities/task-activity.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { TaskConnection } from './types/task-connection.type';
import { CreateTaskInput } from './dto/create-task.input';
import { UpdateTaskInput } from './dto/update-task.input';
import { CreateSubtaskInput } from './dto/create-subtask.input';
import { UpdateSubtaskInput } from './dto/update-subtask.input';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';
import { CreateTaskLabelInput } from './dto/create-task-label.input';
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
    private readonly labelsService: LabelsService,
    private readonly activitiesService: ActivitiesService,
    private readonly attachmentsService: AttachmentsService,
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
  createTask(
    @CurrentUser() user: RequestUser,
    @Args('input') input: CreateTaskInput,
  ) {
    return this.tasksService.create(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Task)
  updateTask(
    @CurrentUser() user: RequestUser,
    @Args('input') input: UpdateTaskInput,
  ) {
    return this.tasksService.update(input.id, input, user.id);
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

  @ResolveField(() => [TaskLabel])
  labels(@Parent() task: Task) {
    return this.labelsService.findByTask(task.id);
  }

  @ResolveField(() => [TaskActivity])
  activities(@Parent() task: Task) {
    return this.activitiesService.findByTask(task.id);
  }

  @ResolveField(() => [TaskAttachment])
  attachments(@Parent() task: Task) {
    return this.attachmentsService.findByTask(task.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Subtask)
  createSubtask(
    @CurrentUser() user: RequestUser,
    @Args('input') input: CreateSubtaskInput,
  ) {
    return this.subtasksService.create(input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Subtask)
  updateSubtask(
    @CurrentUser() user: RequestUser,
    @Args('input') input: UpdateSubtaskInput,
  ) {
    return this.subtasksService.update(input.id, input, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  createChecklist(
    @CurrentUser() user: RequestUser,
    @Args('taskId', { type: () => Int }) taskId: number,
    @Args('title') title: string,
  ) {
    return this.subtasksService.createChecklist(taskId, title, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteChecklist(
    @CurrentUser() user: RequestUser,
    @Args('taskId', { type: () => Int }) taskId: number,
    @Args('title') title: string,
  ) {
    return this.subtasksService.deleteChecklist(taskId, title, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  renameChecklist(
    @CurrentUser() user: RequestUser,
    @Args('taskId', { type: () => Int }) taskId: number,
    @Args('oldTitle') oldTitle: string,
    @Args('newTitle') newTitle: string,
  ) {
    return this.subtasksService.renameChecklist(
      taskId,
      oldTitle,
      newTitle,
      user.id,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteSubtask(
    @CurrentUser() user: RequestUser,
    @Args('id', { type: () => Int }) id: number,
  ) {
    return this.subtasksService.delete(id, user.id);
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

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TaskLabel)
  createTaskLabel(@Args('input') input: CreateTaskLabelInput) {
    return this.labelsService.create(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteTaskLabel(@Args('id', { type: () => Int }) id: number) {
    return this.labelsService.delete(id);
  }
}
