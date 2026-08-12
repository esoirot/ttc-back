import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SubtaskRepository, SubtaskModel } from './subtask.repository';
import { CreateSubtaskInput } from '../dto/create-subtask.input';
import { UpdateSubtaskInput } from '../dto/update-subtask.input';

@Injectable()
export class PrismaSubtaskRepository implements SubtaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTaskIds(taskIds: number[], userId: number): Promise<SubtaskModel[]> {
    return this.prisma.subtask.findMany({
      where: {
        taskId: { in: taskIds },
        task: { OR: [{ project: { userId } }, { assigneeId: userId }] },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number, userId: number): Promise<SubtaskModel> {
    // #18 — owner-or-assignee, joined through the parent Task (mirrors
    // prisma-task.repository.ts's findById).
    const s = await this.prisma.subtask.findFirst({
      where: {
        id,
        task: { OR: [{ project: { userId } }, { assigneeId: userId }] },
      },
    });
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

  async update(
    id: number,
    userId: number,
    data: UpdateSubtaskInput,
  ): Promise<SubtaskModel> {
    const existing = await this.prisma.subtask.findFirst({
      where: {
        id,
        task: { OR: [{ project: { userId } }, { assigneeId: userId }] },
      },
    });
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

  async delete(id: number, userId: number): Promise<SubtaskModel> {
    const existing = await this.prisma.subtask.findFirst({
      where: {
        id,
        task: { OR: [{ project: { userId } }, { assigneeId: userId }] },
      },
    });
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
