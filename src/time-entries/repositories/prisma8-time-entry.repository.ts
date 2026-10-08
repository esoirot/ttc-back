import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and } from '@prisma/orm-postgres/orm-client';
import { occupationFromDb } from '../../occupations/repositories/prisma8-occupation.mapper';
import { taskVisibleTo } from '../../prisma8/access';
import { countOf } from '../../prisma8/count';
import {
  assertOwned,
  assertProjectsUsable,
  assertSubtasksVisible,
  assertTasksVisible,
} from '../../prisma8/ownership';
import { Prisma8Service, Prisma8Tx } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { CreateTimeEntryInput } from '../dto/create-time-entry.input';
import { StartTimerInput } from '../dto/start-timer.input';
import { UpdateTimeEntryInput } from '../dto/update-time-entry.input';
import { TimeEntryModel } from '../types/time-entry.type';
import {
  TimeEntryConnectionModel,
  TimeEntryRepository,
} from './time-entry.repository';

type Filters = Parameters<TimeEntryRepository['findAll']>[1];

const seconds = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / 1000);

@Injectable()
export class Prisma8TimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get entries() {
    return this.db.orm.public.TimeEntry;
  }

  private full(orm = this.db.orm) {
    return orm.public.TimeEntry.include('tags', (t) =>
      t.include('tag', (tag) => tag.select('id', 'name')),
    )
      .include('task', (t) => t.select('id', 'title'))
      .include('subtask', (s) => s.select('id', 'title', 'checklistTitle'))
      .include('occupation');
  }

  private toModel(
    row: NonNullable<
      Awaited<
        ReturnType<ReturnType<Prisma8TimeEntryRepository['full']>['first']>
      >
    >,
  ): TimeEntryModel {
    const { tags, occupation, ...e } = row;
    return {
      ...e,
      startTime: fromDb(e.startTime),
      endTime: fromDb(e.endTime),
      createdAt: fromDb(e.createdAt),
      updatedAt: fromDb(e.updatedAt),
      tags: tags.map((t) => t.tag!),
      occupation: occupation ? occupationFromDb(occupation) : null,
    };
  }

  private async load(id: number, orm = this.db.orm) {
    return this.toModel((await this.full(orm).first({ id }))!);
  }

  /** Every record an entry links to must be one the user may log time on. */
  private async assertRefs(
    userId: number,
    data: {
      projectId?: number | null;
      taskId?: number | null;
      subtaskId?: number | null;
      occupationId?: number | null;
      tagIds?: number[];
    },
  ) {
    const orm = this.db.orm;
    await assertProjectsUsable(orm, userId, data.projectId);
    await assertTasksVisible(orm, userId, data.taskId);
    await assertSubtasksVisible(orm, userId, data.subtaskId);
    await assertOwned(orm, userId, 'Occupation', data.occupationId);
    await assertOwned(orm, userId, 'Tag', data.tagIds);
  }

  private async setTags(tx: Prisma8Tx, timeEntryId: number, tagIds: number[]) {
    await tx.orm.public.TimeEntryTag.where({ timeEntryId }).deleteAndCount();
    await tx.orm.public.TimeEntryTag.createAll(
      tagIds.map((tagId) => ({ timeEntryId, tagId })),
    );
  }

  async findById(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.full().first({ id, userId });
    if (!entry) throw new NotFoundException(`TimeEntry ${id} not found`);
    return this.toModel(entry);
  }

  async existsByClockifyEntryId(
    userId: number,
    clockifyEntryId: string,
  ): Promise<boolean> {
    return (await this.entries.first({ userId, clockifyEntryId })) !== null;
  }

  async findAll(
    userId: number,
    filters: Filters,
    pagination?: { limit?: number; cursor?: number },
  ): Promise<TimeEntryConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    let base = this.full().where({ userId });
    // Most specific filter wins: subtask, then task, then project list, then project.
    if (filters.subtaskId !== undefined)
      base = base.where({ subtaskId: filters.subtaskId });
    else if (filters.taskId !== undefined)
      base = base.where({ taskId: filters.taskId });
    else if (filters.projectIds?.length)
      base = base.where((e) => e.projectId.in(filters.projectIds!));
    else base = base.where({ projectId: filters.projectId });
    if (filters.start) {
      const start = toDb(filters.start);
      base = base.where((e) => e.startTime.gte(start));
    }
    if (filters.end) {
      const end = toDb(filters.end);
      base = base.where((e) => e.startTime.lte(end));
    }

    // Keyset paging on the sort order: continue after the cursor entry.
    let query = base.orderBy([(e) => e.startTime.desc(), (e) => e.id.desc()]);
    if (cursor !== undefined) {
      const after = await this.entries.first({ id: cursor, userId });
      if (after)
        query = query.cursor({ startTime: after.startTime, id: after.id });
    }
    const rows = await query.limit(limit + 1).all();
    const total = await countOf(base);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => this.toModel(r)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async findFirstStartTime(
    userId: number,
    projectId?: number,
  ): Promise<Date | null> {
    const first = await this.entries
      .where({ userId, projectId: projectId ?? undefined })
      .orderBy((e) => e.startTime.asc())
      .first();
    return first ? fromDb(first.startTime) : null;
  }

  async findSubtaskTaskId(subtaskId: number): Promise<number | null> {
    const sub = await this.db.orm.public.Subtask.select('taskId').first({
      id: subtaskId,
    });
    return sub?.taskId ?? null;
  }

  async findDefaultOccupationId(
    projectId: number,
    userId: number,
  ): Promise<number | null> {
    const first = await this.db.orm.public.ProjectOccupation.where({
      projectId,
    })
      .where((o) => o.occupation.some((occ) => occ.userId.eq(userId)))
      .orderBy((o) => o.occupationId.asc())
      .first();
    return first?.occupationId ?? null;
  }

  async findActive(userId: number): Promise<TimeEntryModel | null> {
    const entry = await this.full()
      .where({ userId })
      .where((e) => e.endTime.isNull())
      .first();
    return entry ? this.toModel(entry) : null;
  }

  async create(
    userId: number,
    data: CreateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    await this.assertRefs(userId, data);
    return this.db.transaction(async (tx) => {
      const entry = await tx.orm.public.TimeEntry.create({
        userId,
        projectId: data.projectId,
        taskId: data.taskId,
        subtaskId: data.subtaskId,
        description: data.description,
        startTime: toDb(data.startTime),
        endTime: toDb(data.endTime),
        durationSeconds: seconds(data.startTime, data.endTime),
        billable: data.billable,
        clockifyEntryId: data.clockifyEntryId,
        occupationId: data.occupationId,
        wordsProcessed: data.wordsProcessed,
        updatedAt: nowDb(),
      });
      await this.setTags(tx, entry.id, data.tagIds ?? []);
      return this.load(entry.id, tx.orm);
    });
  }

  async startTimer(
    userId: number,
    data: StartTimerInput,
  ): Promise<TimeEntryModel> {
    if (await this.findActive(userId))
      throw new ConflictException('A timer is already running');
    await this.assertRefs(userId, data);
    return this.db.transaction(async (tx) => {
      const entry = await tx.orm.public.TimeEntry.create({
        userId,
        projectId: data.projectId,
        taskId: data.taskId,
        subtaskId: data.subtaskId,
        description: data.description,
        startTime: nowDb(),
        billable: data.billable,
        occupationId: data.occupationId,
        wordsProcessed: data.wordsProcessed,
        updatedAt: nowDb(),
      });
      await this.setTags(tx, entry.id, data.tagIds ?? []);
      return this.load(entry.id, tx.orm);
    });
  }

  async stopTimer(userId: number): Promise<TimeEntryModel> {
    const active = await this.findActive(userId);
    if (!active) throw new NotFoundException('No active timer');
    const endTime = new Date();
    await this.entries.where({ id: active.id }).update({
      endTime: toDb(endTime),
      durationSeconds: seconds(active.startTime, endTime),
      updatedAt: nowDb(),
    });
    return this.load(active.id);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateTimeEntryInput,
  ): Promise<TimeEntryModel> {
    const entry = await this.findById(id, userId);
    await this.assertRefs(userId, data);
    const { id: _id, tagIds, startTime, endTime, ...fields } = data;
    const start = startTime ?? entry.startTime;
    const end = endTime ?? entry.endTime;
    return this.db.transaction(async (tx) => {
      await tx.orm.public.TimeEntry.where({ id }).update({
        ...fields,
        startTime: startTime === undefined ? undefined : toDb(startTime),
        endTime: endTime === undefined ? undefined : toDb(endTime),
        durationSeconds: end ? seconds(start, end) : entry.durationSeconds,
        updatedAt: nowDb(),
      });
      if (tagIds !== undefined) await this.setTags(tx, id, tagIds);
      return this.load(id, tx.orm);
    });
  }

  async resumeEntry(id: number, userId: number): Promise<TimeEntryModel> {
    if (await this.findActive(userId))
      throw new ConflictException('A timer is already running');
    const entry = await this.findById(id, userId);
    const previous = entry.durationSeconds ?? 0;
    await this.entries.where({ id }).update({
      startTime: toDb(new Date(Date.now() - previous * 1000)),
      endTime: null,
      durationSeconds: null,
      updatedAt: nowDb(),
    });
    return this.load(id);
  }

  async delete(id: number, userId: number): Promise<TimeEntryModel> {
    const entry = await this.findById(id, userId);
    await this.entries.where({ id }).delete();
    return entry;
  }

  private async sumByTask(
    taskIds: number[],
    userId: number,
    field: 'durationSeconds' | 'wordsProcessed',
  ): Promise<Map<number, number>> {
    const rows = await this.entries
      .where((e) =>
        and(e.taskId.in(taskIds), e.task.some(taskVisibleTo(userId))),
      )
      .groupBy('taskId')
      .aggregate((a) => ({ sum: a.sum(field) }));
    return new Map(rows.map((r) => [r.taskId!, r.sum ?? 0]));
  }

  private async sumByProject(
    projectIds: number[],
    userId: number,
    field: 'durationSeconds' | 'wordsProcessed',
  ): Promise<Map<number, number>> {
    const rows = await this.entries
      .where((e) =>
        and(
          e.projectId.in(projectIds),
          e.project.some((p) => p.userId.eq(userId)),
        ),
      )
      .groupBy('projectId')
      .aggregate((a) => ({ sum: a.sum(field) }));
    return new Map(rows.map((r) => [r.projectId!, r.sum ?? 0]));
  }

  sumDurationByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    return this.sumByTask(taskIds, userId, 'durationSeconds');
  }

  sumDurationByProjectIds(
    projectIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    return this.sumByProject(projectIds, userId, 'durationSeconds');
  }

  sumWordsProcessedByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    return this.sumByTask(taskIds, userId, 'wordsProcessed');
  }

  sumWordsProcessedByProjectIds(
    projectIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    return this.sumByProject(projectIds, userId, 'wordsProcessed');
  }
}
