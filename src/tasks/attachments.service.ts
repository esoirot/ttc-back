import { Injectable } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  TaskAttachmentRepository,
  TaskAttachmentModel,
} from './repositories/task-attachment.repository';
import { ActivitiesService } from './activities.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly repo: TaskAttachmentRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  findByTask(taskId: number): Promise<TaskAttachmentModel[]> {
    return this.repo.findByTask(taskId);
  }

  async createFileAttachment(
    taskId: number,
    fileName: string,
    url: string,
    userId: number,
  ): Promise<TaskAttachmentModel> {
    const attachment = await this.repo.create({
      taskId,
      type: 'FILE',
      fileName,
      url,
    });
    await this.activitiesService.log(taskId, userId, 'ATTACHMENT_ADDED', {
      name: fileName,
      url,
    });
    return attachment;
  }

  async createUrlAttachment(
    taskId: number,
    url: string,
    displayText: string | undefined,
    userId: number,
  ): Promise<TaskAttachmentModel> {
    const attachment = await this.repo.create({
      taskId,
      type: 'URL',
      url,
      displayText,
    });
    await this.activitiesService.log(taskId, userId, 'ATTACHMENT_ADDED', {
      name: displayText || url,
      url,
    });
    return attachment;
  }

  async delete(id: number): Promise<void> {
    const attachment = await this.repo.delete(id);
    if (attachment?.type === 'FILE' && attachment.url.startsWith('/uploads/')) {
      const filePath = join(process.cwd(), attachment.url);
      await unlink(filePath).catch(() => undefined);
    }
  }
}
