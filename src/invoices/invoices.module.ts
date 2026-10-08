import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesResolver } from './invoices.resolver';
import { InvoicesController } from './invoices.controller';
import { InvoiceRepository } from './repositories/invoice.repository';
import { Prisma8InvoiceRepository } from './repositories/prisma8-invoice.repository';
import { AuditModule } from '../audit/audit.module';
import { ClientsModule } from '../clients/clients.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuditModule, ClientsModule, UsersModule],
  providers: [
    InvoicesResolver,
    InvoicesService,
    { provide: InvoiceRepository, useClass: Prisma8InvoiceRepository },
  ],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
