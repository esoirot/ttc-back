import { Injectable } from '@nestjs/common';
import {
  TimeEntryRepository,
  TimeEntryConnectionModel,
} from './repositories/time-entry.repository';
import { TimeEntryModel } from './types/time-entry.type';
import { CreateTimeEntryInput } from './dto/create-time-entry.input';
import { StartTimerInput } from './dto/start-timer.input';
import { UpdateTimeEntryInput } from './dto/update-time-entry.input';
import { PrismaService } from '../prisma.service';
import { ActivitiesService } from '../tasks/activities.service';

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly repo: TimeEntryRepository,
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  findAll(
    userId: number,
    filters: {
      projectId?: number;
      projectIds?: number[];
      taskId?: number;
      subtaskId?: number;
      start?: Date;
      end?: Date;
    },
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TimeEntryConnectionModel> {
    return this.repo.findAll(userId, filters, pagination);
  }

  findActive(userId: number): Promise<TimeEntryModel | null> {
    return this.repo.findActive(userId);
  }

  async create(
    userId: number,
    input: CreateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    if (input.subtaskId && !input.taskId) {
      const sub = await this.prisma.subtask.findUnique({
        where: { id: input.subtaskId },
      });
      if (sub) input.taskId = sub.taskId;
    }
    return this.repo.create(userId, input);
  }

  async startTimer(
    userId: number,
    input: StartTimerInput,
  ): Promise<TimeEntryModel> {
    if (input.subtaskId && !input.taskId) {
      const sub = await this.prisma.subtask.findUnique({
        where: { id: input.subtaskId },
      });
      if (sub) input.taskId = sub.taskId;
    }
    const entry = await this.repo.startTimer(userId, input);
    await this.activitiesService.logForTimeEntry(
      entry.id,
      userId,
      'STARTED',
      {
        projectId: entry.projectId,
        taskId: entry.taskId,
        description: entry.description,
      },
      entry.taskId ?? undefined,
    );
    return entry;
  }

  async stopTimer(userId: number): Promise<TimeEntryModel> {
    const entry = await this.repo.stopTimer(userId);
    await this.activitiesService.logForTimeEntry(
      entry.id,
      userId,
      'STOPPED',
      {
        durationSeconds: entry.durationSeconds,
        description: entry.description,
      },
      entry.taskId ?? undefined,
    );
    return entry;
  }

  async resumeEntry(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.repo.resumeEntry(id, userId);
    await this.activitiesService.logForTimeEntry(
      entry.id,
      userId,
      'RESUMED',
      undefined,
      entry.taskId ?? undefined,
    );
    return entry;
  }

  update(
    id: number,
    userId: number,
    input: UpdateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    return this.repo.update(id, userId, input);
  }

  async importEntries(
    userId: number,
    entries: Array<{
      id: string;
      description: string | null;
      start: string;
      end: string;
      billable: boolean;
    }>,
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const entry of entries) {
      const exists = await this.repo.existsByClockifyEntryId(userId, entry.id);
      if (exists) {
        skipped++;
        continue;
      }
      const startTime = new Date(entry.start);
      const endTime = new Date(entry.end);
      const durationSeconds = Math.round(
        (endTime.getTime() - startTime.getTime()) / 1000,
      );
      if (durationSeconds <= 0) {
        skipped++;
        continue;
      }
      await this.repo.create(userId, {
        description: entry.description ?? undefined,
        startTime,
        endTime,
        billable: entry.billable,
        clockifyEntryId: entry.id,
      });
      imported++;
    }
    return { imported, skipped };
  }

  async delete(id: number, userId: number): Promise<boolean> {
    const entry = await this.repo.findById(id, userId);
    await this.activitiesService.logForTimeEntry(
      entry.id,
      userId,
      'DELETED',
      {
        description: entry.description,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationSeconds: entry.durationSeconds,
        projectId: entry.projectId,
        taskId: entry.taskId,
        subtaskId: entry.subtaskId,
      },
      entry.taskId ?? undefined,
    );
    await this.repo.delete(id, userId);
    return true;
  }
}
