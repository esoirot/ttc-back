import { Injectable } from '@nestjs/common';
import {
  SubtaskRepository,
  SubtaskModel,
} from './repositories/subtask.repository';
import { TaskRepository } from './repositories/task.repository';
import { ActivitiesService } from './activities.service';
import { CreateSubtaskInput } from './dto/create-subtask.input';
import { UpdateSubtaskInput } from './dto/update-subtask.input';

@Injectable()
export class SubtasksService {
  constructor(
    private readonly repo: SubtaskRepository,
    private readonly taskRepo: TaskRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  findByTask(taskId: number): Promise<SubtaskModel[]> {
    return this.repo.findByTask(taskId);
  }

  async create(
    input: CreateSubtaskInput,
    userId: number,
  ): Promise<SubtaskModel> {
    const subtask = await this.repo.create(input);
    await this.activitiesService.log(input.taskId, userId, 'CHECKLIST_ADDED', {
      title: input.title,
    });
    return subtask;
  }

  async update(
    id: number,
    input: UpdateSubtaskInput,
    userId: number,
  ): Promise<SubtaskModel> {
    const before = await this.repo.findById(id);
    const subtask = await this.repo.update(id, input);
    if (input.done !== undefined && input.done !== before.done) {
      await this.activitiesService.log(
        subtask.taskId,
        userId,
        'CHECKLIST_ITEM_TOGGLED',
        {
          title: subtask.title,
          checklistTitle: subtask.checklistTitle,
          done: subtask.done,
        },
      );
    } else {
      await this.activitiesService.log(
        subtask.taskId,
        userId,
        'CHECKLIST_UPDATED',
        { title: subtask.title, checklistTitle: subtask.checklistTitle },
      );
    }
    return subtask;
  }

  async createChecklist(
    taskId: number,
    title: string,
    userId: number,
  ): Promise<boolean> {
    await this.taskRepo.addChecklistTitle(taskId, title);
    await this.activitiesService.log(taskId, userId, 'CHECKLIST_CREATED', {
      title,
    });
    return true;
  }

  async deleteChecklist(
    taskId: number,
    title: string,
    userId: number,
  ): Promise<boolean> {
    await this.repo.deleteByChecklist(taskId, title);
    await this.taskRepo.removeChecklistTitle(taskId, title);
    await this.activitiesService.log(taskId, userId, 'CHECKLIST_REMOVED', {
      title,
    });
    return true;
  }

  async renameChecklist(
    taskId: number,
    oldTitle: string,
    newTitle: string,
    userId: number,
  ): Promise<boolean> {
    await this.repo.renameChecklist(taskId, oldTitle, newTitle);
    await this.taskRepo.renameChecklistTitle(taskId, oldTitle, newTitle);
    await this.activitiesService.log(taskId, userId, 'CHECKLIST_RENAMED', {
      from: oldTitle,
      to: newTitle,
    });
    return true;
  }

  async delete(id: number, userId: number): Promise<boolean> {
    const subtask = await this.repo.delete(id);
    await this.activitiesService.log(
      subtask.taskId,
      userId,
      'CHECKLIST_DELETED',
      { title: subtask.title },
    );
    return true;
  }
}
