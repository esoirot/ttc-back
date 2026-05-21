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
import { CreateTimeEntryInput } from '../dto/create-time-entry.input';
import { StartTimerInput } from '../dto/start-timer.input';
import { UpdateTimeEntryInput } from '../dto/update-time-entry.input';

function computeDuration(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 1000);
}

@Injectable()
export class PrismaTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    return entry;
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
      start?: Date;
      end?: Date;
    },
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TimeEntryConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = {
      userId,
      ...(filters.projectIds !== undefined && filters.projectIds.length > 0
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
      orderBy: { startTime: 'desc' },
      take: limit + 1,
    });
    const total = await this.prisma.timeEntry.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor, total };
  }

  async findActive(userId: number): Promise<TimeEntryModel | null> {
    return this.prisma.timeEntry.findFirst({
      where: { userId, endTime: null },
    });
  }

  async create(
    userId: number,
    data: CreateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    const duration = computeDuration(data.startTime, data.endTime);
    return this.prisma.timeEntry.create({
      data: {
        userId,
        projectId: data.projectId,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        durationSeconds: duration,
        billable: data.billable ?? true,
        clockifyEntryId: data.clockifyEntryId,
      },
    });
  }

  async startTimer(
    userId: number,
    data: StartTimerInput,
  ): Promise<TimeEntryModel> {
    const active = await this.findActive(userId);
    if (active) throw new ConflictException('A timer is already running');
    return this.prisma.timeEntry.create({
      data: {
        userId,
        projectId: data.projectId,
        description: data.description,
        startTime: new Date(),
        billable: data.billable ?? true,
      },
    });
  }

  async stopTimer(userId: number): Promise<TimeEntryModel> {
    const active = await this.findActive(userId);
    if (!active) throw new NotFoundException('No active timer');
    const endTime = new Date();
    const durationSeconds = computeDuration(active.startTime, endTime);
    return this.prisma.timeEntry.update({
      where: { id: active.id },
      data: { endTime, durationSeconds },
    });
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
    const { id: _id, ...fields } = data;
    const startTime = fields.startTime ?? entry.startTime;
    const endTime = fields.endTime ?? entry.endTime;
    const durationSeconds =
      endTime !== null && endTime !== undefined
        ? computeDuration(startTime, endTime)
        : entry.durationSeconds;
    return this.prisma.timeEntry.update({
      where: { id },
      data: { ...fields, durationSeconds },
    });
  }

  async delete(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    return this.prisma.timeEntry.delete({ where: { id } });
  }
}
