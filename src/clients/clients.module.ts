import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsResolver } from './clients.resolver';
import { ClientStatusHistoryService } from './client-status-history.service';
import { ProspectCronService } from './prospect-cron.service';
import { ClientRepository } from './repositories/client.repository';
import { PrismaClientRepository } from './repositories/prisma-client.repository';
import { ClientStatusHistoryRepository } from './repositories/client-status-history.repository';
import { Prisma8ClientStatusHistoryRepository } from './repositories/prisma8-client-status-history.repository';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    ClientsResolver,
    ClientsService,
    ClientStatusHistoryService,
    ProspectCronService,
    PrismaService,
    PrismaClientRepository,
    { provide: ClientRepository, useClass: PrismaClientRepository },
    {
      provide: ClientStatusHistoryRepository,
      useClass: Prisma8ClientStatusHistoryRepository,
    },
  ],
  exports: [ClientsService, ClientStatusHistoryService],
})
export class ClientsModule {}
