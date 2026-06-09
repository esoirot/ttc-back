import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubtasksService } from './subtasks.service';
import { CommentsService } from './comments.service';
import { LabelsService } from './labels.service';
import { ActivitiesService } from './activities.service';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { TasksResolver } from './tasks.resolver';
import { TaskRepository } from './repositories/task.repository';
import { PrismaTaskRepository } from './repositories/prisma-task.repository';
import { SubtaskRepository } from './repositories/subtask.repository';
import { PrismaSubtaskRepository } from './repositories/prisma-subtask.repository';
import { CommentRepository } from './repositories/comment.repository';
import { PrismaCommentRepository } from './repositories/prisma-comment.repository';
import { TaskLabelRepository } from './repositories/task-label.repository';
import { PrismaTaskLabelRepository } from './repositories/prisma-task-label.repository';
import { TaskActivityRepository } from './repositories/task-activity.repository';
import { PrismaTaskActivityRepository } from './repositories/prisma-task-activity.repository';
import { TaskAttachmentRepository } from './repositories/task-attachment.repository';
import { PrismaTaskAttachmentRepository } from './repositories/prisma-task-attachment.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AttachmentsController],
  providers: [
    TasksResolver,
    TasksService,
    SubtasksService,
    CommentsService,
    LabelsService,
    ActivitiesService,
    AttachmentsService,
    PrismaService,
    PrismaTaskRepository,
    { provide: TaskRepository, useClass: PrismaTaskRepository },
    PrismaSubtaskRepository,
    { provide: SubtaskRepository, useClass: PrismaSubtaskRepository },
    PrismaCommentRepository,
    { provide: CommentRepository, useClass: PrismaCommentRepository },
    PrismaTaskLabelRepository,
    { provide: TaskLabelRepository, useClass: PrismaTaskLabelRepository },
    PrismaTaskActivityRepository,
    { provide: TaskActivityRepository, useClass: PrismaTaskActivityRepository },
    PrismaTaskAttachmentRepository,
    {
      provide: TaskAttachmentRepository,
      useClass: PrismaTaskAttachmentRepository,
    },
  ],
})
export class TasksModule {}
