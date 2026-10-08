import { Injectable } from '@nestjs/common';
import { and } from '@prisma/orm-postgres/orm-client';
import { ClientStatus } from '../../clients/entities/client.entity';
import { isProspectDueForContact } from '../../clients/prospect-due.util';
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

const PROSPECT_CANDIDATE_STATUSES = [
  'TO_CONTACT',
  'CONTACTED',
  'FOLLOW_UP_1',
  'FOLLOW_UP_2',
  'RECONTACT_LATER',
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
    const nowDb = toDb(now);
    const weekLater = toDb(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

    const [
      activeProjectCount,
      unpaidInvoiceCount,
      monthTime,
      monthRevenue,
      deadlineProjects,
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
      orm.Project.where({ userId })
        .where((p) => and(p.deadline.gte(nowDb), p.deadline.lte(weekLater)))
        .where((p) => p.status.notIn(['COMPLETED', 'CANCELLED', 'ARCHIVED']))
        .orderBy((p) => p.deadline.asc())
        .select('id', 'title', 'deadline', 'status')
        .all(),
      orm.TimeEntry.where({ userId })
        .orderBy((e) => e.startTime.desc())
        .limit(5)
        .select('id', 'description', 'startTime', 'durationSeconds')
        .all(),
      orm.Client.where({ userId })
        .where((c) => c.status.in([...PROSPECT_CANDIDATE_STATUSES]))
        .select('id', 'name', 'status', 'contactedAt')
        .all(),
      orm.TimeEntry.where({ userId })
        .where((e) => and(e.startTime.gte(yearStart), e.startTime.lt(yearEnd)))
        .aggregate((a) => ({ words: a.sum('wordsProcessed') })),
    ]);

    const upcomingDeadlines: DashboardDeadlineModel[] = deadlineProjects.map(
      (p) => ({
        id: p.id,
        title: p.title,
        deadline: fromDb(p.deadline!).toISOString(),
        status: p.status,
      }),
    );
    const recentTimeEntries: DashboardEntryModel[] = recentEntries.map((e) => ({
      id: e.id,
      description: e.description,
      startTime: fromDb(e.startTime).toISOString(),
      durationSeconds: e.durationSeconds,
    }));
    const prospectsToContact: DashboardProspectModel[] = prospectCandidates
      .map((c) => ({ ...c, contactedAt: fromDb(c.contactedAt) }))
      .filter((c) =>
        isProspectDueForContact(c.status as ClientStatus, c.contactedAt, now),
      )
      .sort(
        (a, b) =>
          (a.contactedAt?.getTime() ?? 0) - (b.contactedAt?.getTime() ?? 0),
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        contactedAt: c.contactedAt?.toISOString() ?? null,
      }));

    return {
      activeProjectCount,
      unpaidInvoiceCount,
      monthToDateSeconds: monthTime.seconds ?? 0,
      monthToDateRevenue: Number(monthRevenue.total ?? 0),
      yearToDateWords: yearWords.words ?? 0,
      upcomingDeadlines,
      recentTimeEntries,
      prospectsToContact,
    };
  }
}
