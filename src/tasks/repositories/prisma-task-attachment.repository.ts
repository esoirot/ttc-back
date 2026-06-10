import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  TaskAttachmentRepository,
  TaskAttachmentModel,
} from './task-attachment.repository';

type CreateInput = {
  taskId: number;
  type: string;
  fileName?: string;
  url: string;
  displayText?: string;
  storageKey?: string;
  storageDriver?: string;
};

@Injectable()
export class PrismaTaskAttachmentRepository implements TaskAttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: number): Promise<TaskAttachmentModel[]> {
    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: number): Promise<TaskAttachmentModel | null> {
    return this.prisma.taskAttachment.findUnique({ where: { id } });
  }

  create(data: CreateInput): Promise<TaskAttachmentModel> {
    return this.prisma.taskAttachment.create({
      data: {
        taskId: data.taskId,
        type: data.type,
        fileName: data.fileName ?? null,
        url: data.url,
        displayText: data.displayText ?? null,
        storageKey: data.storageKey ?? null,
        storageDriver: data.storageDriver ?? null,
      },
    });
  }

  async update(
    id: number,
    data: { url?: string; displayText?: string | null },
  ): Promise<TaskAttachmentModel | null> {
    const existing = await this.prisma.taskAttachment.findUnique({
      where: { id },
    });
    if (!existing) return null;
    return this.prisma.taskAttachment.update({
      where: { id },
      data: {
        ...(data.url !== undefined && { url: data.url }),
        ...(data.displayText !== undefined && {
          displayText: data.displayText,
        }),
      },
    });
  }

  async delete(id: number): Promise<TaskAttachmentModel | null> {
    const existing = await this.prisma.taskAttachment.findUnique({
      where: { id },
    });
    if (!existing) return null;
    return this.prisma.taskAttachment.delete({ where: { id } });
  }
}
