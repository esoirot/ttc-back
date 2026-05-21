import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CleanupService } from './cleanup.service';

@Module({
  providers: [PrismaService, CleanupService],
})
export class CleanupModule {}
