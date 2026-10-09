import { Injectable } from '@nestjs/common';
import { and } from '@prisma/orm-postgres/orm-client';
import { ClientStatus } from '../../clients/entities/client.entity';
import {
  newestContactDate,
  prospectDueAt,
} from '../../clients/prospect-due.util';
import { taskVisibleTo } from '../../prisma8/access';
import { countOf } from '../../prisma8/count';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, toDb } from '../../prisma8/timestamp';
import type {
  DashboardDeadlineModel,
  DashboardEntryModel,
  DashboardModel,
  DashboardProspectModel,
} from '../types/dashboard.type';
import { DashboardRepository } from './dashboard.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Overdue items, plus everything due within this many days. */
const DEADLINE_HORIZON_DAYS = 30;
const DEADLINE_LIMIT = 20;
/** Prospects due now, plus those coming due within this many days. */
const PROSPECT_HORIZON_DAYS = 30;
const FINISHED_PROJECT_STATUSES = [
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
  'INVOICE_SENT',
  'INVOICE_PAID',
] as const;
const FINISHED_TASK_STATUSES = ['DONE', 'PAID'] as const;

const PROSPECT_CANDIDATE_STATUSES = [
  'TO_CONTACT',
  'CONTACTED',
  'FOLLOW_UP_1',
  'FOLLOW_UP_2',
  'RECONTACT_LATER',
  'FORMER_CLIENT',
] as const;

@Injectable()
export class Prisma8DashboardRepository implements DashboardRepository {
  constructor(private readonly db: Prisma8Service) {}

  async getDashboard(userId: number): Promise<DashboardModel> {
    const orm = this.db.orm.public;
    const now = new Date();
    const monthStart = toDb(new Date(now.getFullYear(), now.getMonth(), 1));
    const yearStart = toDb(new Date(now.getFullYear(), 0, 1));
    const yearEnd = toDb(new Date(now.getFullYear() + 1, 0, 1));

    const [
      activeProjectCount,
      unpaidInvoiceCount,
      monthTime,
      monthRevenue,
      upcomingDeadlines,
      recentEntries,
      prospectCandidates,
      yearWords,
    ] = await Promise.all([
      countOf(orm.Project.where({ userId, status: 'ACTIVE' })),
      countOf(
        orm.Invoice.where({ userId }).where((i) =>
          i.status.in(['SENT', 'OVERDUE']),
        ),
      ),
      orm.TimeEntry.where({ userId })
        .where((e) => e.startTime.gte(monthStart))
        .aggregate((a) => ({ seconds: a.sum('durationSeconds') })),
      orm.InvoiceItem.where((item) =>
        item.invoice.some((i) =>
          and(i.userId.eq(userId), i.issuedAt.gte(monthStart)),
        ),
      ).aggregate((a) => ({ total: a.sum('total') })),
      this.deadlines(userId, now),
      orm.TimeEntry.where({ userId })
        .orderBy((e) => e.startTime.desc())
        .limit(5)
        .select('id', 'description', 'startTime', 'durationSeconds')
        .all(),
      orm.Client.where({ userId })
        .where((c) => c.status.in([...PROSPECT_CANDIDATE_STATUSES]))
        .select('id', 'name', 'status', 'contactedAt', 'toRecontactAt')
        .all(),
      this.yearTaskWords(userId, yearStart, yearEnd),
    ]);

    const recentTimeEntries: DashboardEntryModel[] = recentEntries.map((e) => ({
      id: e.id,
      description: e.description,
      startTime: fromDb(e.startTime).toISOString(),
      durationSeconds: e.durationSeconds,
    }));
    const prospectHorizon = now.getTime() + PROSPECT_HORIZON_DAYS * DAY_MS;
    const prospectsToContact: DashboardProspectModel[] = prospectCandidates
      .map((c) => {
        const contactedAt = fromDb(c.contactedAt);
        const since = newestContactDate(contactedAt, fromDb(c.toRecontactAt));
        const dueAt = prospectDueAt(c.status as ClientStatus, since);
        return { ...c, contactedAt, dueAt };
      })
      .filter(
        (c) =>
          c.dueAt === null ||
          (c.dueAt !== undefined && c.dueAt.getTime() <= prospectHorizon),
      )
      .sort(
        (a, b) =>
          (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0) || a.id - b.id,
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        contactedAt: c.contactedAt?.toISOString() ?? null,
        dueAt: c.dueAt?.toISOString() ?? null,
      }));

    return {
      activeProjectCount,
      unpaidInvoiceCount,
      monthToDateSeconds: monthTime.seconds ?? 0,
      monthToDateRevenue: Number(monthRevenue.total ?? 0),
      yearToDateWords: yearWords,
      upcomingDeadlines,
      recentTimeEntries,
      prospectsToContact,
    };
  }

  /**
   * Words of the tasks finished this year (DONE / PAID, due date in the
   * year): each task's own words plus its counted checklist items' words.
   * Time entry words never count.
   */
  private async yearTaskWords(
    userId: number,
    yearStart: ReturnType<typeof toDb>,
    yearEnd: ReturnType<typeof toDb>,
  ): Promise<number> {
    const orm = this.db.orm.public;
    const tasks = await orm.Task.where(taskVisibleTo(userId))
      .where((t) =>
        and(
          t.status.in([...FINISHED_TASK_STATUSES]),
          t.dueDate.gte(yearStart),
          t.dueDate.lt(yearEnd),
        ),
      )
      .select('id', 'wordCount')
      .all();
    if (tasks.length === 0) return 0;
    const items = await orm.Subtask.where({ countInTotal: true })
      .where((s) => s.taskId.in(tasks.map((t) => t.id)))
      .aggregate((a) => ({ words: a.sum('wordCount') }));
    return (
      tasks.reduce((sum, t) => sum + (t.wordCount ?? 0), 0) + (items.words ?? 0)
    );
  }

  /**
   * Open projects, tasks and checklist items that are overdue or due within
   * DEADLINE_HORIZON_DAYS, earliest first, at most DEADLINE_LIMIT in all.
   */
  private async deadlines(
    userId: number,
    now: Date,
  ): Promise<DashboardDeadlineModel[]> {
    const orm = this.db.orm.public;
    const horizon = toDb(
      new Date(now.getTime() + DEADLINE_HORIZON_DAYS * DAY_MS),
    );
    const [projects, tasks, items] = await Promise.all([
      orm.Project.where({ userId })
        .where((p) => p.deadline.lte(horizon))
        .where((p) => p.status.notIn([...FINISHED_PROJECT_STATUSES]))
        .orderBy((p) => p.deadline.asc())
        .limit(DEADLINE_LIMIT)
        .all(),
      orm.Task.where(taskVisibleTo(userId))
        .where((t) => t.dueDate.lte(horizon))
        .where((t) => t.status.notIn([...FINISHED_TASK_STATUSES]))
        .include('project', (p) => p.select('id', 'title'))
        .orderBy((t) => t.dueDate.asc())
        .limit(DEADLINE_LIMIT)
        .all(),
      orm.Subtask.where({ done: false })
        .where((s) => s.dueDate.lte(horizon))
        .where((s) => s.task.some(taskVisibleTo(userId)))
        .include('task', (t) =>
          t
            .select('id', 'title', 'projectId')
            .include('project', (p) => p.select('id', 'title')),
        )
        .orderBy((s) => s.dueDate.asc())
        .limit(DEADLINE_LIMIT)
        .all(),
    ]);
    const due = (d: string | null) => fromDb(d!).toISOString();
    return [
      ...projects.map((p) => ({
        kind: 'PROJECT' as const,
        id: p.id,
        title: p.title,
        deadline: due(p.deadline),
        projectId: p.id,
        projectTitle: p.title,
        taskId: null,
        taskTitle: null,
      })),
      ...tasks.map((t) => ({
        kind: 'TASK' as const,
        id: t.id,
        title: t.title,
        deadline: due(t.dueDate),
        projectId: t.projectId,
        projectTitle: t.project!.title,
        taskId: t.id,
        taskTitle: t.title,
      })),
      ...items.map((s) => ({
        kind: 'CHECKLIST_ITEM' as const,
        id: s.id,
        title: s.title,
        deadline: due(s.dueDate),
        projectId: s.task!.projectId,
        projectTitle: s.task!.project!.title,
        taskId: s.task!.id,
        taskTitle: s.task!.title,
      })),
    ]
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, DEADLINE_LIMIT);
  }
}
