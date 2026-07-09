import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { PrismaClientLike, runExport } from '../../scripts/db-backup.core';

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 10 * * *')
  async runDailyBackup(): Promise<void> {
    try {
      const { file, counts } = await runExport(
        this.prisma as unknown as PrismaClientLike,
      );
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
