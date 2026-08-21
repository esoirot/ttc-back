import { Injectable, UnauthorizedException } from '@nestjs/common';
import DataLoader from 'dataloader';
import { SubtasksService } from '../../tasks/subtasks.service';
import { CommentsService } from '../../tasks/comments.service';
import { LabelsService } from '../../tasks/labels.service';
import { ActivitiesService } from '../../tasks/activities.service';
import { AttachmentsService } from '../../tasks/attachments.service';
import { ClientStatusHistoryService } from '../../clients/client-status-history.service';
import { TimeEntriesService } from '../../time-entries/time-entries.service';
import { SubtaskModel } from '../../tasks/repositories/subtask.repository';
import { TaskCommentModel } from '../../tasks/repositories/comment.repository';
import { TaskLabelModel } from '../../tasks/repositories/task-label.repository';
import { TaskActivityModel } from '../../tasks/repositories/task-activity.repository';
import { TaskAttachmentModel } from '../../tasks/repositories/task-attachment.repository';
import { ClientStatusHistoryModel } from '../../clients/repositories/client-status-history.repository';
import {
  createGroupedListLoader,
  createMappedValueLoader,
} from './batch-loader.util';

export interface GqlLoaders {
  subtasksByTask: DataLoader<number, SubtaskModel[]>;
  commentsByTask: DataLoader<number, TaskCommentModel[]>;
  labelsByTask: DataLoader<number, TaskLabelModel[]>;
  activitiesByTask: DataLoader<number, TaskActivityModel[]>;
  attachmentsByTask: DataLoader<number, TaskAttachmentModel[]>;
  activitiesByTimeEntry: DataLoader<number, TaskActivityModel[]>;
  statusHistoryByClient: DataLoader<number, ClientStatusHistoryModel[]>;
  totalSecondsByTask: DataLoader<number, number | null>;
  totalSecondsByProject: DataLoader<number, number | null>;
  totalWordsProcessedByProject: DataLoader<number, number | null>;
}

/**
 * Per-request userId is read lazily (not at loader-construction time) because
 * the GraphQL `context` factory runs before GqlAuthGuard populates `req.user`.
 * Batch functions only execute once a resolver calls `.load()`, which never
 * happens before the guarded parent query has already run — so by then
 * `getUserId()` is safe to call.
 */
function requireUserId(getUserId: () => number | undefined): number {
  const userId = getUserId();
  if (userId === undefined) {
    throw new UnauthorizedException('No authenticated user for this request');
  }
  return userId;
}

@Injectable()
export class LoadersService {
  constructor(
    private readonly subtasksService: SubtasksService,
    private readonly commentsService: CommentsService,
    private readonly labelsService: LabelsService,
    private readonly activitiesService: ActivitiesService,
    private readonly attachmentsService: AttachmentsService,
    private readonly clientStatusHistoryService: ClientStatusHistoryService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  createLoaders(getUserId: () => number | undefined): GqlLoaders {
    return {
      subtasksByTask: createGroupedListLoader(
        (taskIds) =>
          this.subtasksService.findByTaskIds(
            [...taskIds],
            requireUserId(getUserId),
          ),
        (s) => s.taskId,
      ),
      commentsByTask: createGroupedListLoader(
        (taskIds) =>
          this.commentsService.findByTaskIds(
            [...taskIds],
            requireUserId(getUserId),
          ),
        (c) => c.taskId,
      ),
      labelsByTask: createGroupedListLoader(
        (taskIds) =>
          this.labelsService.findByTaskIds(
            [...taskIds],
            requireUserId(getUserId),
          ),
        (l) => l.taskId,
      ),
      activitiesByTask: createGroupedListLoader(
        (taskIds) =>
          this.activitiesService.findByTaskIds(
            [...taskIds],
            requireUserId(getUserId),
          ),
        (a) => a.taskId as number,
      ),
      attachmentsByTask: createGroupedListLoader(
        (taskIds) =>
          this.attachmentsService.findByTaskIds(
            [...taskIds],
            requireUserId(getUserId),
          ),
        (a) => a.taskId,
      ),
      activitiesByTimeEntry: createGroupedListLoader(
        (timeEntryIds) =>
          this.activitiesService.findByTimeEntryIds(
            [...timeEntryIds],
            requireUserId(getUserId),
          ),
        (a) => a.timeEntryId as number,
      ),
      statusHistoryByClient: createGroupedListLoader(
        (clientIds) =>
          this.clientStatusHistoryService.findByClientIds(
            [...clientIds],
            requireUserId(getUserId),
          ),
        (h) => h.clientId,
      ),
      totalSecondsByTask: createMappedValueLoader(
        (taskIds) =>
          this.timeEntriesService.getTotalDurationByTaskIds(
            [...taskIds],
            requireUserId(getUserId),
          ),
        null,
      ),
      totalSecondsByProject: createMappedValueLoader(
        (projectIds) =>
          this.timeEntriesService.getTotalDurationByProjectIds(
            [...projectIds],
            requireUserId(getUserId),
          ),
        null,
      ),
      totalWordsProcessedByProject: createMappedValueLoader(
        (projectIds) =>
          this.timeEntriesService.getTotalWordsProcessedByProjectIds(
            [...projectIds],
            requireUserId(getUserId),
          ),
        null,
      ),
    };
  }
}
