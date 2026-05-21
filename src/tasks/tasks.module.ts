import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubtasksService } from './subtasks.service';
import { CommentsService } from './comments.service';
import { TasksResolver } from './tasks.resolver';
import { TaskRepository } from './repositories/task.repository';
import { PrismaTaskRepository } from './repositories/prisma-task.repository';
import { SubtaskRepository } from './repositories/subtask.repository';
import { PrismaSubtaskRepository } from './repositories/prisma-subtask.repository';
import { CommentRepository } from './repositories/comment.repository';
import { PrismaCommentRepository } from './repositories/prisma-comment.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    TasksResolver,
    TasksService,
    SubtasksService,
    CommentsService,
    PrismaService,
    PrismaTaskRepository,
    { provide: TaskRepository, useClass: PrismaTaskRepository },
    PrismaSubtaskRepository,
    { provide: SubtaskRepository, useClass: PrismaSubtaskRepository },
    PrismaCommentRepository,
    { provide: CommentRepository, useClass: PrismaCommentRepository },
  ],
})
export class TasksModule {}
