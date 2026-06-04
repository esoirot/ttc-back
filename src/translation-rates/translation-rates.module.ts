import { Module } from '@nestjs/common';
import { TranslationRatesService } from './translation-rates.service';
import { TranslationRatesResolver } from './translation-rates.resolver';
import { TranslationRateRepository } from './repositories/translation-rate.repository';
import { PrismaTranslationRateRepository } from './repositories/prisma-translation-rate.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    TranslationRatesResolver,
    TranslationRatesService,
    PrismaService,
    PrismaTranslationRateRepository,
    {
      provide: TranslationRateRepository,
      useClass: PrismaTranslationRateRepository,
    },
  ],
  exports: [TranslationRatesService],
})
export class TranslationRatesModule {}
