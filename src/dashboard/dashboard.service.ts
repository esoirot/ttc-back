import { Injectable } from '@nestjs/common';
import { DashboardRepository } from './repositories/dashboard.repository';
import type { DashboardModel } from './types/dashboard.type';

@Injectable()
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  getDashboard(userId: number): Promise<DashboardModel> {
    return this.repo.getDashboard(userId);
  }
}
