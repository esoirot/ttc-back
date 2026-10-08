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
import { Prisma8TaskRepository } from './repositories/prisma8-task.repository';
import { SubtaskRepository } from './repositories/subtask.repository';
import { Prisma8SubtaskRepository } from './repositories/prisma8-subtask.repository';
import { CommentRepository } from './repositories/comment.repository';
import { Prisma8CommentRepository } from './repositories/prisma8-comment.repository';
import { TaskLabelRepository } from './repositories/task-label.repository';
import { Prisma8TaskLabelRepository } from './repositories/prisma8-task-label.repository';
import { TaskActivityRepository } from './repositories/task-activity.repository';
import { Prisma8TaskActivityRepository } from './repositories/prisma8-task-activity.repository';
import { TaskAttachmentRepository } from './repositories/task-attachment.repository';
import { Prisma8TaskAttachmentRepository } from './repositories/prisma8-task-attachment.repository';

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
    { provide: TaskRepository, useClass: Prisma8TaskRepository },
    { provide: SubtaskRepository, useClass: Prisma8SubtaskRepository },
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
