import { Module } from '@nestjs/common';
import { RatesService } from './rates.service';
import { RatesResolver } from './rates.resolver';
import { RateRepository } from './repositories/rate.repository';
import { PrismaRateRepository } from './repositories/prisma-rate.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    RatesResolver,
    RatesService,
    PrismaService,
    PrismaRateRepository,
    { provide: RateRepository, useClass: PrismaRateRepository },
  ],
  exports: [RatesService],
})
export class RatesModule {}
