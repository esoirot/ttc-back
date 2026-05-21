import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardRepository } from './repositories/dashboard.repository';
import { PrismaDashboardRepository } from './repositories/prisma-dashboard.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    DashboardResolver,
    DashboardService,
    PrismaService,
    PrismaDashboardRepository,
    { provide: DashboardRepository, useClass: PrismaDashboardRepository },
  ],
})
export class DashboardModule {}
