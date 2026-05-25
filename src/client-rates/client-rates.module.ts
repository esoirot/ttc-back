import { Module } from '@nestjs/common';
import { ClientRatesService } from './client-rates.service';
import { ClientRatesResolver } from './client-rates.resolver';
import { ClientRateRepository } from './repositories/client-rate.repository';
import { PrismaClientRateRepository } from './repositories/prisma-client-rate.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    ClientRatesResolver,
    ClientRatesService,
    PrismaService,
    PrismaClientRateRepository,
    { provide: ClientRateRepository, useClass: PrismaClientRateRepository },
  ],
  exports: [ClientRatesService],
})
export class ClientRatesModule {}
