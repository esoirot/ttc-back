import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { AdminRepository } from './repositories/admin.repository';
import { Prisma8AdminRepository } from './repositories/prisma8-admin.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    AdminResolver,
    AdminService,
    { provide: AdminRepository, useClass: Prisma8AdminRepository },
  ],
})
export class AdminModule {}
