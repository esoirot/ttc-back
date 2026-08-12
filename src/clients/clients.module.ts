import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsResolver } from './clients.resolver';
import { ClientStatusHistoryService } from './client-status-history.service';
import { ProspectCronService } from './prospect-cron.service';
import { ClientRepository } from './repositories/client.repository';
import { PrismaClientRepository } from './repositories/prisma-client.repository';
import { ClientStatusHistoryRepository } from './repositories/client-status-history.repository';
import { PrismaClientStatusHistoryRepository } from './repositories/prisma-client-status-history.repository';
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
    PrismaClientStatusHistoryRepository,
    {
      provide: ClientStatusHistoryRepository,
      useClass: PrismaClientStatusHistoryRepository,
    },
  ],
  exports: [ClientsService, ClientStatusHistoryService],
})
export class ClientsModule {}
