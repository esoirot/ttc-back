import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsResolver } from './clients.resolver';
import { ProspectCronService } from './prospect-cron.service';
import { ClientRepository } from './repositories/client.repository';
import { PrismaClientRepository } from './repositories/prisma-client.repository';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    ClientsResolver,
    ClientsService,
    ProspectCronService,
    PrismaService,
    PrismaClientRepository,
    { provide: ClientRepository, useClass: PrismaClientRepository },
  ],
  exports: [ClientsService],
})
export class ClientsModule {}
