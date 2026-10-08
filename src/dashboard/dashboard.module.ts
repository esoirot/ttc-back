import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardRepository } from './repositories/dashboard.repository';
import { Prisma8DashboardRepository } from './repositories/prisma8-dashboard.repository';

@Module({
  providers: [
    DashboardResolver,
    DashboardService,
    { provide: DashboardRepository, useClass: Prisma8DashboardRepository },
  ],
})
export class DashboardModule {}
