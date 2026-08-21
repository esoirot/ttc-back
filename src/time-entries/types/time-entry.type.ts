import type {
  Activity as PrismaActivity,
  InvoicingStatus,
} from '../../generated/prisma/client';

export type TimeEntryModel = {
  id: number;
  userId: number;
  projectId: number | null;
  taskId: number | null;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  billable: boolean;
  clockifyEntryId: string | null;
  activityId: number | null;
  activity: PrismaActivity | null;
  wordsProcessed: number | null;
  invoicingStatus: InvoicingStatus;
  tags: { id: number; name: string }[];
  task: { id: number; title: string } | null;
  subtaskId: number | null;
  subtask: { id: number; title: string; checklistTitle: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};
