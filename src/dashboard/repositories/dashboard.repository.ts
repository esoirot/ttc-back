import type { DashboardModel } from '../types/dashboard.type';

export abstract class DashboardRepository {
  abstract getDashboard(userId: number): Promise<DashboardModel>;
}
