import { Module } from '@nestjs/common';
import { OccupationsService } from './occupations.service';
import { OccupationsResolver } from './occupations.resolver';
import { OccupationsRepository } from './repositories/occupations.repository';
import { Prisma8OccupationsRepository } from './repositories/prisma8-occupations.repository';

@Module({
  providers: [
    OccupationsResolver,
    OccupationsService,
    {
      provide: OccupationsRepository,
      useClass: Prisma8OccupationsRepository,
    },
  ],
})
export class OccupationsModule {}
