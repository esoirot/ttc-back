import { Module } from '@nestjs/common';
import { RateSheetsService } from './rate-sheets.service';
import { RateSheetsResolver } from './rate-sheets.resolver';
import { RateSheetRepository } from './repositories/rate-sheet.repository';
import { PrismaRateSheetRepository } from './repositories/prisma-rate-sheet.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    RateSheetsResolver,
    RateSheetsService,
    PrismaService,
    PrismaRateSheetRepository,
    { provide: RateSheetRepository, useClass: PrismaRateSheetRepository },
  ],
  exports: [RateSheetsService],
})
export class RateSheetsModule {}
