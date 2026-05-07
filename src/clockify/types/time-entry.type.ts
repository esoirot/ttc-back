type ClockifyTimeInterval = {
  start: string;
  end: string | null;
  duration: string | null;
};

export type ClockifyTimeEntry = {
  id: string;
  description: string | null;
  projectId: string | null;
  tagIds: string[];
  timeInterval: ClockifyTimeInterval;
  workspaceId: string;
  billable: boolean;
};
