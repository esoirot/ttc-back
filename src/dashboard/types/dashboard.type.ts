export interface DashboardDeadlineModel {
  id: number;
  title: string;
  deadline: string;
  status: string;
}

export interface DashboardEntryModel {
  id: number;
  description: string | null;
  startTime: string;
  durationSeconds: number | null;
}

export interface DashboardProspectModel {
  id: number;
  name: string;
  status: string;
  contactedAt: string | null;
}

export interface DashboardModel {
  activeProjectCount: number;
  unpaidInvoiceCount: number;
  monthToDateSeconds: number;
  monthToDateRevenue: number;
  upcomingDeadlines: DashboardDeadlineModel[];
  recentTimeEntries: DashboardEntryModel[];
  prospectsToContact: DashboardProspectModel[];
}
