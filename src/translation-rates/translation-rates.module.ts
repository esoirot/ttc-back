import { Module } from '@nestjs/common';
import { TranslationRatesService } from './translation-rates.service';
import { TranslationRatesResolver } from './translation-rates.resolver';
import { TranslationRateRepository } from './repositories/translation-rate.repository';
import { Prisma8TranslationRateRepository } from './repositories/prisma8-translation-rate.repository';

@Module({
  providers: [
    TranslationRatesResolver,
    TranslationRatesService,
    {
      provide: TranslationRateRepository,
      useClass: Prisma8TranslationRateRepository,
    },
  ],
  exports: [TranslationRatesService],
})
export class TranslationRatesModule {}
