type DeadlineKind = 'PROJECT' | 'TASK' | 'CHECKLIST_ITEM';

/** Something with a due date: a project, a task or a checklist item. */
export interface DashboardDeadlineModel {
  kind: DeadlineKind;
  id: number;
  title: string;
  deadline: string;
  projectId: number;
  projectTitle: string;
  taskId: number | null;
  taskTitle: string | null;
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
  yearToDateWords: number;
  upcomingDeadlines: DashboardDeadlineModel[];
  recentTimeEntries: DashboardEntryModel[];
  prospectsToContact: DashboardProspectModel[];
}
