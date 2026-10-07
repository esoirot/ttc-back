import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { nowDb, toDb } from '../../prisma8/timestamp';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly db: Prisma8Service) {}

  @Cron('0 3 * * *')
  async purgeExpiredPasswordResetTokens(): Promise<void> {
    try {
      const now = nowDb();
      const count = await this.db.orm.public.PasswordResetToken.where((t) =>
        t.expiresAt.lt(now),
      ).deleteAndCount();
      this.logger.log(`Purged ${count} expired password reset tokens`);
    } catch (err: unknown) {
      this.logger.error(
        'Failed to purge expired password reset tokens',
        String(err),
      );
    }
  }

  @Cron('0 4 * * *')
  async purgeOldAuditLogs(): Promise<void> {
    try {
      const days = Number(process.env['AUDIT_RETENTION_DAYS'] ?? '90');
      const cutoff = toDb(new Date(Date.now() - days * 86_400_000));
      const count = await this.db.orm.public.AuditLog.where((l) =>
        l.createdAt.lt(cutoff),
      ).deleteAndCount();
      this.logger.log(
        `Purged ${count} audit log entries older than ${days} days`,
      );
    } catch (err: unknown) {
      this.logger.error('Failed to purge old audit logs', String(err));
    }
  }
}
