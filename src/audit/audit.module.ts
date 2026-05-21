import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

@Module({
  providers: [PrismaService, AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
