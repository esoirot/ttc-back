import { Injectable, Logger } from '@nestjs/common';
import { Prisma8Service } from '../prisma8/prisma8.service.js';
import { fromDb } from '../prisma8/timestamp.js';

type AuditLogPayload = object;

type AuditLogEntry = {
  id: number;
  userId: number;
  action: string;
  resource: string;
  payload: unknown;
  createdAt: Date;
  user: { email: string };
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: Prisma8Service) {}

  log(
    userId: number,
    action: string,
    resource: string,
    payload?: AuditLogPayload,
  ): void {
    void this.db.orm.public.AuditLog.create({
      userId,
      action,
      resource,
      ...(payload !== undefined ? { payload: payload as never } : {}),
    }).catch((err: unknown) => {
      this.logger.error('Audit log write failed', String(err));
    });
  }

  async findAll(opts: {
    userId?: number;
    cursor?: number;
    limit?: number;
  }): Promise<{ items: AuditLogEntry[]; nextCursor: number | null }> {
    const limit = opts.limit ?? 50;
    let query = this.db.orm.public.AuditLog.where({ userId: opts.userId });
    if (opts.cursor !== undefined) {
      const cursor = opts.cursor;
      query = query.where((l) => l.id.lt(cursor));
    }
    const rows = await query
      .include('user', (u) => u.select('email'))
      .orderBy((l) => l.id.desc())
      .limit(limit + 1)
      .all();
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      ...r,
      createdAt: fromDb(r.createdAt),
      user: r.user!,
    }));
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }
}
