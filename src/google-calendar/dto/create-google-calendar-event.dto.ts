import { ApiProperty } from '@nestjs/swagger';

export class CreateGoogleCalendarEventDto {
  @ApiProperty({
    description: 'Event title',
    example: 'Client call',
  })
  summary!: string;

  @ApiProperty({
    description: 'Start time, ISO 8601',
    example: '2026-07-10T14:00:00.000Z',
  })
  startDateTime!: string;

  @ApiProperty({
    description: 'End time, ISO 8601',
    example: '2026-07-10T15:00:00.000Z',
  })
  endDateTime!: string;
}
