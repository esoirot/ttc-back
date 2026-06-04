import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesResolver } from './activities.resolver';
import { ActivitiesRepository } from './repositories/activities.repository';
import { PrismaActivitiesRepository } from './repositories/prisma-activities.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    ActivitiesResolver,
    ActivitiesService,
    PrismaService,
    PrismaActivitiesRepository,
    {
      provide: ActivitiesRepository,
      useClass: PrismaActivitiesRepository,
    },
  ],
})
export class ActivitiesModule {}
