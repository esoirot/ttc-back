import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { runExport } from '../../scripts/db-backup.core';
import { prisma8BackupClient } from '../../scripts/db-backup.prisma8';

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly db: Prisma8Service) {}

  @Cron('0 10 * * *')
  async runDailyBackup(): Promise<void> {
    try {
      const { file, counts } = await runExport(prisma8BackupClient(this.db));
      const totalRows = Object.values(counts).reduce(
        (sum, count) => sum + count,
        0,
      );
      this.logger.log(`Wrote ${file} (${totalRows} rows)`);
    } catch (err: unknown) {
      this.logger.error('Failed to run daily DB backup', String(err));
    }
  }
}
