import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
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
import { Prisma8CommentRepository } from './repositories/prisma8-comment.repository';
import { TaskLabelRepository } from './repositories/task-label.repository';
import { Prisma8TaskLabelRepository } from './repositories/prisma8-task-label.repository';
import { TaskActivityRepository } from './repositories/task-activity.repository';
import { Prisma8TaskActivityRepository } from './repositories/prisma8-task-activity.repository';
import { TaskAttachmentRepository } from './repositories/task-attachment.repository';
import { Prisma8TaskAttachmentRepository } from './repositories/prisma8-task-attachment.repository';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [StorageModule.register()],
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
    { provide: CommentRepository, useClass: Prisma8CommentRepository },
    { provide: TaskLabelRepository, useClass: Prisma8TaskLabelRepository },
    {
      provide: TaskActivityRepository,
      useClass: Prisma8TaskActivityRepository,
    },
    {
      provide: TaskAttachmentRepository,
      useClass: Prisma8TaskAttachmentRepository,
    },
  ],
  exports: [
    ActivitiesService,
    SubtasksService,
    CommentsService,
    LabelsService,
    AttachmentsService,
  ],
})
export class TasksModule {}
