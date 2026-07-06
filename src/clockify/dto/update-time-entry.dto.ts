import { ApiProperty } from '@nestjs/swagger';

export class UpdateTimeEntryDto {
  @ApiProperty({
    description: 'ISO 8601 start time',
    example: '2026-05-20T09:00:00Z',
  })
  start!: string;

  @ApiProperty({
    description: 'ISO 8601 end time; omit to leave the entry running',
    required: false,
    example: '2026-05-20T10:30:00Z',
  })
  end?: string;

  @ApiProperty({ description: 'Entry description', required: false })
  description?: string;

  @ApiProperty({
    description: 'Clockify project ID; null clears the project',
    required: false,
    nullable: true,
  })
  projectId?: string | null;

  @ApiProperty({ description: 'Whether the entry is billable' })
  billable!: boolean;

  @ApiProperty({
    description: 'Clockify tag IDs — full replace, not merge',
    type: [String],
  })
  tagIds!: string[];
}
