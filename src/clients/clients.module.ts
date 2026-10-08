import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsResolver } from './clients.resolver';
import { ClientStatusHistoryService } from './client-status-history.service';
import { ProspectCronService } from './prospect-cron.service';
import { ClientRepository } from './repositories/client.repository';
import { Prisma8ClientRepository } from './repositories/prisma8-client.repository';
import { ClientStatusHistoryRepository } from './repositories/client-status-history.repository';
import { Prisma8ClientStatusHistoryRepository } from './repositories/prisma8-client-status-history.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    ClientsResolver,
    ClientsService,
    ClientStatusHistoryService,
    ProspectCronService,
    { provide: ClientRepository, useClass: Prisma8ClientRepository },
    {
      provide: ClientStatusHistoryRepository,
      useClass: Prisma8ClientStatusHistoryRepository,
    },
  ],
  exports: [ClientsService, ClientStatusHistoryService],
})
export class ClientsModule {}
