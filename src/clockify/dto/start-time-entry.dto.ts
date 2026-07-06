import { ApiProperty } from '@nestjs/swagger';

export class StartTimeEntryDto {
  @ApiProperty({
    description: 'Entry description',
    required: false,
    example: 'Translation review',
  })
  description?: string;

  @ApiProperty({
    description: 'Clockify project ID to log time against',
    required: false,
  })
  projectId?: string;

  @ApiProperty({
    description: 'Clockify tag IDs to attach',
    required: false,
    type: [String],
  })
  tagIds?: string[];

  @ApiProperty({
    description: 'ISO 8601 start time; defaults to now if omitted',
    required: false,
    example: '2026-05-20T09:00:00Z',
  })
  start?: string;

  @ApiProperty({
    description: 'Whether the entry is billable',
    required: false,
    default: false,
  })
  billable?: boolean;
}
