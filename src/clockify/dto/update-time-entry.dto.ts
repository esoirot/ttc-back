export class UpdateTimeEntryDto {
  start!: string;
  end?: string;
  description?: string;
  projectId?: string | null;
  billable!: boolean;
  tagIds!: string[];
}
