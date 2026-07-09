import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DbBackupService } from './db-backup.service';

@Module({
  providers: [PrismaService, DbBackupService],
})
export class DbBackupModule {}
