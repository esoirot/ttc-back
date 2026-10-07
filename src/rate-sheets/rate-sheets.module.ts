import { Module } from '@nestjs/common';
import { RateSheetsService } from './rate-sheets.service';
import { RateSheetsResolver } from './rate-sheets.resolver';
import { RateSheetRepository } from './repositories/rate-sheet.repository';
import { Prisma8RateSheetRepository } from './repositories/prisma8-rate-sheet.repository';

@Module({
  providers: [
    RateSheetsResolver,
    RateSheetsService,
    { provide: RateSheetRepository, useClass: Prisma8RateSheetRepository },
  ],
  exports: [RateSheetsService],
})
export class RateSheetsModule {}
