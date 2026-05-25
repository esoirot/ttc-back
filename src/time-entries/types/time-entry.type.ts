export type TimeEntryModel = {
  id: number;
  userId: number;
  projectId: number | null;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  billable: boolean;
  clockifyEntryId: string | null;
  tags: { id: number; name: string }[];
  createdAt: Date;
  updatedAt: Date;
};
