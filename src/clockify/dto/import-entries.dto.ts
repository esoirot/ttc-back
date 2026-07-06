import { ApiProperty } from '@nestjs/swagger';

export class ImportEntriesDto {
  @ApiProperty({
    description: 'ISO date range start (inclusive)',
    example: '2026-05-01',
  })
  start!: string;

  @ApiProperty({
    description: 'ISO date range end (inclusive)',
    example: '2026-05-31',
  })
  end!: string;
}
