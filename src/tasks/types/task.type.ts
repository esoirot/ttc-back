export type TaskModel = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  wordCount: number | null;
  color: string | null;
  sortOrder: number;
  checklistTitles: string[];
  createdAt: Date;
  updatedAt: Date;
};
