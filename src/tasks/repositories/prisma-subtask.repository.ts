import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SubtaskRepository, SubtaskModel } from './subtask.repository';
import { CreateSubtaskInput } from '../dto/create-subtask.input';
import { UpdateSubtaskInput } from '../dto/update-subtask.input';

@Injectable()
export class PrismaSubtaskRepository implements SubtaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: number): Promise<SubtaskModel[]> {
    return this.prisma.subtask.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: CreateSubtaskInput): Promise<SubtaskModel> {
    return this.prisma.subtask.create({
      data: { taskId: data.taskId, title: data.title },
    });
  }

  async update(id: number, data: UpdateSubtaskInput): Promise<SubtaskModel> {
    const existing = await this.prisma.subtask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Subtask ${id} not found`);
    return this.prisma.subtask.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
      },
    });
  }

  async delete(id: number): Promise<SubtaskModel> {
    const existing = await this.prisma.subtask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Subtask ${id} not found`);
    return this.prisma.subtask.delete({ where: { id } });
  }
}
