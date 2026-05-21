import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async purgeExpiredPasswordResetTokens(): Promise<void> {
    try {
      const { count } = await this.prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
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
      const cutoff = new Date(Date.now() - days * 86_400_000);
      const { count } = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(
        `Purged ${count} audit log entries older than ${days} days`,
      );
    } catch (err: unknown) {
      this.logger.error('Failed to purge old audit logs', String(err));
    }
  }
}
