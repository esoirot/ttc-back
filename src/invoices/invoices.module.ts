import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesResolver } from './invoices.resolver';
import { InvoicesController } from './invoices.controller';
import { InvoiceRepository } from './repositories/invoice.repository';
import { PrismaInvoiceRepository } from './repositories/prisma-invoice.repository';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';
import { ClientsModule } from '../clients/clients.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuditModule, ClientsModule, UsersModule],
  providers: [
    InvoicesResolver,
    InvoicesService,
    PrismaService,
    PrismaInvoiceRepository,
    { provide: InvoiceRepository, useClass: PrismaInvoiceRepository },
  ],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
