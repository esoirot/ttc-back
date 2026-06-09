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

  async findById(id: number): Promise<SubtaskModel> {
    const s = await this.prisma.subtask.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Subtask ${id} not found`);
    return s;
  }

  create(data: CreateSubtaskInput): Promise<SubtaskModel> {
    return this.prisma.subtask.create({
      data: {
        taskId: data.taskId,
        checklistTitle: data.checklistTitle ?? null,
        title: data.title,
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      },
    });
  }

  async update(id: number, data: UpdateSubtaskInput): Promise<SubtaskModel> {
    const existing = await this.prisma.subtask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Subtask ${id} not found`);
    return this.prisma.subtask.update({
      where: { id },
      data: {
        ...(data.checklistTitle !== undefined
          ? { checklistTitle: data.checklistTitle }
          : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      },
    });
  }

  async delete(id: number): Promise<SubtaskModel> {
    const existing = await this.prisma.subtask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Subtask ${id} not found`);
    return this.prisma.subtask.delete({ where: { id } });
  }

  async renameChecklist(
    taskId: number,
    oldTitle: string,
    newTitle: string,
  ): Promise<number> {
    const result = await this.prisma.subtask.updateMany({
      where: { taskId, checklistTitle: oldTitle },
      data: { checklistTitle: newTitle },
    });
    return result.count;
  }

  async deleteByChecklist(taskId: number, title: string): Promise<number> {
    const result = await this.prisma.subtask.deleteMany({
      where: { taskId, checklistTitle: title },
    });
    return result.count;
  }
}
