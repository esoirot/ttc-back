import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DashboardRepository } from './dashboard.repository';
import { ClientStatus as PrismaClientStatus } from '../../generated/prisma/client';
import { ClientStatus } from '../../clients/entities/client.entity';
import { isProspectDueForContact } from '../../clients/prospect-due.util';
import type {
  DashboardModel,
  DashboardDeadlineModel,
  DashboardEntryModel,
  DashboardProspectModel,
} from '../types/dashboard.type';

const PROSPECT_CANDIDATE_STATUSES: PrismaClientStatus[] = [
  PrismaClientStatus.TO_CONTACT,
  PrismaClientStatus.CONTACTED,
  PrismaClientStatus.FOLLOW_UP_1,
  PrismaClientStatus.FOLLOW_UP_2,
  PrismaClientStatus.RECONTACT_LATER,
];

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: number): Promise<DashboardModel> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      activeProjectCount,
      unpaidInvoiceCount,
      monthTimeEntries,
      monthInvoiceItems,
      deadlineProjects,
      recentEntries,
      prospectCandidates,
    ] = await Promise.all([
      this.prisma.project.count({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.invoice.count({
        where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          userId,
          startTime: { gte: monthStart },
          durationSeconds: { not: null },
        },
        select: { durationSeconds: true },
      }),
      this.prisma.invoiceItem.findMany({
        where: { invoice: { userId, issuedAt: { gte: monthStart } } },
        select: { total: true },
      }),
      this.prisma.project.findMany({
        where: {
          userId,
          deadline: { gte: now, lte: weekLater },
          status: { notIn: ['COMPLETED', 'CANCELLED', 'ARCHIVED'] },
        },
        orderBy: { deadline: 'asc' },
        select: { id: true, title: true, deadline: true, status: true },
      }),
      this.prisma.timeEntry.findMany({
        where: { userId },
        orderBy: { startTime: 'desc' },
        take: 5,
        select: {
          id: true,
          description: true,
          startTime: true,
          durationSeconds: true,
        },
      }),
      this.prisma.client.findMany({
        where: { userId, status: { in: PROSPECT_CANDIDATE_STATUSES } },
        select: { id: true, name: true, status: true, contactedAt: true },
      }),
    ]);

    const monthToDateSeconds = monthTimeEntries.reduce(
      (sum, e) => sum + (e.durationSeconds ?? 0),
      0,
    );

    const monthToDateRevenue = monthInvoiceItems.reduce(
      (sum, item) => sum + item.total.toNumber(),
      0,
    );

    const upcomingDeadlines: DashboardDeadlineModel[] = deadlineProjects.map(
      (p) => ({
        id: p.id,
        title: p.title,
        deadline: p.deadline!.toISOString(),
        status: p.status,
      }),
    );

    const recentTimeEntries: DashboardEntryModel[] = recentEntries.map((e) => ({
      id: e.id,
      description: e.description,
      startTime: e.startTime.toISOString(),
      durationSeconds: e.durationSeconds,
    }));

    const prospectsToContact: DashboardProspectModel[] = prospectCandidates
      .filter((c) =>
        isProspectDueForContact(
          c.status as unknown as ClientStatus,
          c.contactedAt,
          now,
        ),
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
      monthToDateSeconds,
      monthToDateRevenue,
      upcomingDeadlines,
      recentTimeEntries,
      prospectsToContact,
    };
  }
}
