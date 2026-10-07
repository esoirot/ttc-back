import { Module } from '@nestjs/common';
import { ClientRatesService } from './client-rates.service';
import { ClientRatesResolver } from './client-rates.resolver';
import { ClientRateRepository } from './repositories/client-rate.repository';
import { Prisma8ClientRateRepository } from './repositories/prisma8-client-rate.repository';

@Module({
  providers: [
    ClientRatesResolver,
    ClientRatesService,
    { provide: ClientRateRepository, useClass: Prisma8ClientRateRepository },
  ],
  exports: [ClientRatesService],
})
export class ClientRatesModule {}
