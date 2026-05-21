import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardData } from './entities/dashboard.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type RequestUser = { id: number; role: string };

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => DashboardData, { name: 'dashboard' })
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(user.id);
  }
}
