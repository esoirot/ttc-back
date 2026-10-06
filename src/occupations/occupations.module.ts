import { Module } from '@nestjs/common';
import { OccupationsService } from './occupations.service';
import { OccupationsResolver } from './occupations.resolver';
import { OccupationsRepository } from './repositories/occupations.repository';
import { PrismaOccupationsRepository } from './repositories/prisma-occupations.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    OccupationsResolver,
    OccupationsService,
    PrismaService,
    PrismaOccupationsRepository,
    {
      provide: OccupationsRepository,
      useClass: PrismaOccupationsRepository,
    },
  ],
})
export class OccupationsModule {}
