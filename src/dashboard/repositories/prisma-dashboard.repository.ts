import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DashboardRepository } from './dashboard.repository';
import type {
  DashboardModel,
  DashboardDeadlineModel,
  DashboardEntryModel,
} from '../types/dashboard.type';

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

    return {
      activeProjectCount,
      unpaidInvoiceCount,
      monthToDateSeconds,
      monthToDateRevenue,
      upcomingDeadlines,
      recentTimeEntries,
    };
  }
}
