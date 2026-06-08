import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TaskLabelRepository, TaskLabelModel } from './task-label.repository';
import { CreateTaskLabelInput } from '../dto/create-task-label.input';

@Injectable()
export class PrismaTaskLabelRepository implements TaskLabelRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: number): Promise<TaskLabelModel[]> {
    return this.prisma.taskLabel.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: CreateTaskLabelInput): Promise<TaskLabelModel> {
    return this.prisma.taskLabel.create({
      data: {
        taskId: data.taskId,
        name: data.name,
        color: data.color ?? '#6B7280',
      },
    });
  }

  async delete(id: number): Promise<TaskLabelModel> {
    const label = await this.prisma.taskLabel.findUnique({ where: { id } });
    if (!label) throw new NotFoundException(`Label ${id} not found`);
    return this.prisma.taskLabel.delete({ where: { id } });
  }
}
