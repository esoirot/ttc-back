import { Injectable } from '@nestjs/common';
import { StorageRegistry } from '../storage';
import {
  TaskAttachmentRepository,
  TaskAttachmentModel,
} from './repositories/task-attachment.repository';
import { TaskRepository } from './repositories/task.repository';
import { ActivitiesService } from './activities.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly repo: TaskAttachmentRepository,
    private readonly taskRepo: TaskRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly storageRegistry: StorageRegistry,
  ) {}

  findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<TaskAttachmentModel[]> {
    return this.repo.findByTaskIds(taskIds, userId);
  }

  async createFileAttachment(
    taskId: number,
    fileName: string,
    buffer: Buffer,
    userId: number,
    driver?: string,
  ): Promise<TaskAttachmentModel> {
    await this.taskRepo.findById(taskId, userId);
    const provider = this.storageRegistry.get(driver);
    const { storageKey, url } = await provider.upload(fileName, buffer);

    const attachment = await this.repo.create({
      taskId,
      type: 'FILE',
      fileName,
      url,
      storageKey,
      storageDriver: provider.driverName,
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
    await this.taskRepo.findById(taskId, userId);
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

  async update(
    id: number,
    url: string,
    displayText: string | undefined,
    userId: number,
  ): Promise<TaskAttachmentModel | null> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) return null;
    const updated = await this.repo.update(
      id,
      {
        url,
        displayText: displayText ?? null,
      },
      userId,
    );
    await this.activitiesService.log(
      existing.taskId,
      userId,
      'ATTACHMENT_UPDATED',
      {
        name: displayText || url,
        url,
      },
    );
    return updated;
  }

  async delete(id: number, userId: number): Promise<void> {
    const attachment = await this.repo.delete(id, userId);
    if (attachment) {
      await this.activitiesService.log(
        attachment.taskId,
        userId,
        'ATTACHMENT_DELETED',
        {
          name: attachment.fileName ?? attachment.displayText ?? attachment.url,
          url: attachment.url,
        },
      );
    }
    if (attachment?.type === 'FILE') {
      const driverName = attachment.storageDriver ?? 'local';
      const key = attachment.storageKey ?? attachment.url;
      await this.storageRegistry.get(driverName).delete(key);
    }
  }
}
