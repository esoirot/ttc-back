export type TaskModel = {
  id: number;
  projectId: number;
  assigneeId: number | null;
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  sortOrder: number;
  checklistTitles: string[];
  createdAt: Date;
  updatedAt: Date;
};
