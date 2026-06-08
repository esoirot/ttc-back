import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  TaskActivityRepository,
  TaskActivityModel,
  LogActivityInput,
} from './task-activity.repository';

@Injectable()
export class PrismaTaskActivityRepository implements TaskActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: number): Promise<TaskActivityModel[]> {
    return this.prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  log(data: LogActivityInput): Promise<TaskActivityModel> {
    return this.prisma.taskActivity.create({
      data: {
        taskId: data.taskId,
        userId: data.userId,
        type: data.type,
        payload: data.payload ? JSON.stringify(data.payload) : null,
      },
    });
  }
}
