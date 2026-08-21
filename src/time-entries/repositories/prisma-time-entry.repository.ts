import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  TimeEntryRepository,
  TimeEntryConnectionModel,
} from './time-entry.repository';
import { TimeEntryModel } from '../types/time-entry.type';
import type {
  Activity as PrismaActivity,
  InvoicingStatus,
} from '../../generated/prisma/client';
import { CreateTimeEntryInput } from '../dto/create-time-entry.input';
import { StartTimerInput } from '../dto/start-timer.input';
import { UpdateTimeEntryInput } from '../dto/update-time-entry.input';

const TAG_INCLUDE = {
  tags: { include: { tag: { select: { id: true, name: true } } } },
  task: { select: { id: true, title: true } },
  subtask: { select: { id: true, title: true, checklistTitle: true } },
  activity: true,
} as const;

type PrismaEntryWithTags = {
  id: number;
  userId: number;
  projectId: number | null;
  taskId: number | null;
  subtaskId: number | null;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  billable: boolean;
  clockifyEntryId: string | null;
  activityId: number | null;
  wordsProcessed: number | null;
  invoicingStatus: InvoicingStatus;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { id: number; name: string } }[];
  task: { id: number; title: string } | null;
  subtask: { id: number; title: string; checklistTitle: string | null } | null;
  activity: PrismaActivity | null;
};

function toModel(row: PrismaEntryWithTags): TimeEntryModel {
  const { tags, ...rest } = row;
  return { ...rest, tags: tags.map((t) => t.tag) };
}

function computeDuration(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 1000);
}

@Injectable()
export class PrismaTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, userId },
      include: TAG_INCLUDE,
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    return toModel(entry);
  }

  async existsByClockifyEntryId(
    userId: number,
    clockifyEntryId: string,
  ): Promise<boolean> {
    const count = await this.prisma.timeEntry.count({
      where: { userId, clockifyEntryId },
    });
    return count > 0;
  }

  async findAll(
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
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = {
      userId,
      ...(filters.subtaskId !== undefined
        ? { subtaskId: filters.subtaskId }
        : filters.taskId !== undefined
          ? { taskId: filters.taskId }
          : filters.projectIds !== undefined && filters.projectIds.length > 0
            ? { projectId: { in: filters.projectIds } }
            : filters.projectId !== undefined
              ? { projectId: filters.projectId }
              : {}),
      ...(filters.start || filters.end
        ? {
            startTime: {
              ...(filters.start ? { gte: filters.start } : {}),
              ...(filters.end ? { lte: filters.end } : {}),
            },
          }
        : {}),
    };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.prisma.timeEntry.findMany({
      where,
      include: TAG_INCLUDE,
      orderBy: { startTime: 'desc' },
      take: limit + 1,
    });
    const total = await this.prisma.timeEntry.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items: items.map(toModel), nextCursor, total };
  }

  async findActive(userId: number): Promise<TimeEntryModel | null> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { userId, endTime: null },
      include: TAG_INCLUDE,
    });
    return entry ? toModel(entry) : null;
  }

  async create(
    userId: number,
    data: CreateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    const duration = computeDuration(data.startTime, data.endTime);
    const entry = await this.prisma.timeEntry.create({
      data: {
        userId,
        projectId: data.projectId,
        taskId: data.taskId,
        subtaskId: data.subtaskId,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        durationSeconds: duration,
        billable: data.billable ?? true,
        clockifyEntryId: data.clockifyEntryId,
        activityId: data.activityId,
        wordsProcessed: data.wordsProcessed,
        ...(data.tagIds?.length
          ? { tags: { create: data.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: TAG_INCLUDE,
    });
    return toModel(entry);
  }

  async startTimer(
    userId: number,
    data: StartTimerInput,
  ): Promise<TimeEntryModel> {
    const active = await this.findActive(userId);
    if (active) throw new ConflictException('A timer is already running');
    const entry = await this.prisma.timeEntry.create({
      data: {
        userId,
        projectId: data.projectId,
        taskId: data.taskId,
        subtaskId: data.subtaskId,
        description: data.description,
        startTime: new Date(),
        billable: data.billable ?? true,
        activityId: data.activityId,
        wordsProcessed: data.wordsProcessed,
        ...(data.tagIds?.length
          ? { tags: { create: data.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: TAG_INCLUDE,
    });
    return toModel(entry);
  }

  async stopTimer(userId: number): Promise<TimeEntryModel> {
    const active = await this.findActive(userId);
    if (!active) throw new NotFoundException('No active timer');
    const endTime = new Date();
    const durationSeconds = computeDuration(active.startTime, endTime);
    // Workaround for prisma/prisma#29407 (open upstream bug: update()+multi-relation
    // include triggers concurrent client.query() on the pg driver-adapter's tx client).
    // Revert to the single call below once the upstream fix (PR #29468) ships and we
    // upgrade prisma/@prisma/adapter-pg.
    // const entry = await this.prisma.timeEntry.update({
    //   where: { id: active.id },
    //   data: { endTime, durationSeconds },
    //   include: TAG_INCLUDE,
    // });
    await this.prisma.timeEntry.update({
      where: { id: active.id },
      data: { endTime, durationSeconds },
    });
    const entry = await this.prisma.timeEntry.findUniqueOrThrow({
      where: { id: active.id },
      include: TAG_INCLUDE,
    });
    return toModel(entry);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    const { id: _id, tagIds, ...fields } = data;
    const startTime = fields.startTime ?? entry.startTime;
    const endTime = fields.endTime ?? entry.endTime;
    const durationSeconds =
      endTime !== null && endTime !== undefined
        ? computeDuration(startTime, endTime)
        : entry.durationSeconds;
    // Workaround for prisma/prisma#29407 (open upstream bug: update()+multi-relation
    // include triggers concurrent client.query() on the pg driver-adapter's tx client).
    // Revert to the single call below once the upstream fix (PR #29468) ships and we
    // upgrade prisma/@prisma/adapter-pg.
    // const updated = await this.prisma.timeEntry.update({
    //   where: { id },
    //   data: {
    //     ...fields,
    //     durationSeconds,
    //     ...(tagIds !== undefined
    //       ? {
    //           tags: {
    //             deleteMany: {},
    //             create: tagIds.map((tagId) => ({ tagId })),
    //           },
    //         }
    //       : {}),
    //   },
    //   include: TAG_INCLUDE,
    // });
    await this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...fields,
        durationSeconds,
        ...(tagIds !== undefined
          ? {
              tags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
    });
    const updated = await this.prisma.timeEntry.findUniqueOrThrow({
      where: { id },
      include: TAG_INCLUDE,
    });
    return toModel(updated);
  }

  async resumeEntry(id: number, userId: number): Promise<TimeEntryModel> {
    const active = await this.findActive(userId);
    if (active) throw new ConflictException('A timer is already running');
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    const previousSecs = entry.durationSeconds ?? 0;
    const newStart = new Date(Date.now() - previousSecs * 1000);
    // Workaround for prisma/prisma#29407 (open upstream bug: update()+multi-relation
    // include triggers concurrent client.query() on the pg driver-adapter's tx client).
    // Revert to the single call below once the upstream fix (PR #29468) ships and we
    // upgrade prisma/@prisma/adapter-pg.
    // const resumed = await this.prisma.timeEntry.update({
    //   where: { id },
    //   data: { startTime: newStart, endTime: null, durationSeconds: null },
    //   include: TAG_INCLUDE,
    // });
    await this.prisma.timeEntry.update({
      where: { id },
      data: { startTime: newStart, endTime: null, durationSeconds: null },
    });
    const resumed = await this.prisma.timeEntry.findUniqueOrThrow({
      where: { id },
      include: TAG_INCLUDE,
    });
    return toModel(resumed);
  }

  async delete(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    const deleted = await this.prisma.timeEntry.delete({
      where: { id },
      include: TAG_INCLUDE,
    });
    return toModel(deleted);
  }

  async sumDurationByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    // Sums every contributor's time on the task (owner + assignee may both log
    // time against it) — the userId filter only gates *access* to the task
    // (owner-or-assignee, same as prisma-task.repository.ts's findById), it
    // must not also restrict which entries get summed.
    const rows = await this.prisma.timeEntry.groupBy({
      by: ['taskId'],
      where: {
        taskId: { in: taskIds },
        task: { OR: [{ project: { userId } }, { assigneeId: userId }] },
      },
      _sum: { durationSeconds: true },
    });
    return new Map(
      rows
        .filter((r) => r.taskId !== null)
        .map((r) => [r.taskId as number, r._sum.durationSeconds ?? 0]),
    );
  }

  async sumDurationByProjectIds(
    projectIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    // Sums every contributor's time on the project — userId only gates access
    // (project owner), it must not also restrict which entries get summed.
    const rows = await this.prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, project: { userId } },
      _sum: { durationSeconds: true },
    });
    return new Map(
      rows
        .filter((r) => r.projectId !== null)
        .map((r) => [r.projectId as number, r._sum.durationSeconds ?? 0]),
    );
  }

  async sumWordsProcessedByProjectIds(
    projectIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    // Sums every contributor's wordsProcessed on the project — userId only
    // gates access (project owner), it must not also restrict which entries
    // get summed. Mirrors sumDurationByProjectIds above.
    const rows = await this.prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, project: { userId } },
      _sum: { wordsProcessed: true },
    });
    return new Map(
      rows
        .filter((r) => r.projectId !== null)
        .map((r) => [r.projectId as number, r._sum.wordsProcessed ?? 0]),
    );
  }
}
