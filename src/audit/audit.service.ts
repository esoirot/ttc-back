import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';

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

  constructor(private readonly prisma: PrismaService) {}

  log(
    userId: number,
    action: string,
    resource: string,
    payload?: AuditLogPayload,
  ): void {
    void this.prisma.auditLog
      .create({
        data: {
          userId,
          action,
          resource,
          ...(payload !== undefined
            ? {
                payload:
                  payload as unknown as Prisma.NullableJsonNullValueInput,
              }
            : {}),
        },
      })
      .catch((err: unknown) => {
        this.logger.error('Audit log write failed', String(err));
      });
  }

  async findAll(opts: {
    userId?: number;
    cursor?: number;
    limit?: number;
  }): Promise<{ items: AuditLogEntry[]; nextCursor: number | null }> {
    const limit = opts.limit ?? 50;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
        ...(opts.cursor !== undefined ? { id: { lt: opts.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: { user: { select: { email: true } } },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }
}
