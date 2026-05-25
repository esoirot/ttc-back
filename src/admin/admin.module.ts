import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { AdminRepository } from './repositories/admin.repository';
import { PrismaAdminRepository } from './repositories/prisma-admin.repository';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    AdminResolver,
    AdminService,
    { provide: AdminRepository, useClass: PrismaAdminRepository },
    PrismaService,
  ],
})
export class AdminModule {}
