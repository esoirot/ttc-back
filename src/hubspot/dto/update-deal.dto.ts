import { ApiProperty } from '@nestjs/swagger';

export class UpdateDealDto {
  @ApiProperty({ required: false, example: 'Website localization — Q3' })
  dealname?: string;

  @ApiProperty({
    description: 'Deal value, as a numeric string (HubSpot API convention)',
    required: false,
    example: '2500',
  })
  amount?: string;

  @ApiProperty({ description: 'HubSpot pipeline stage ID', required: false })
  dealstage?: string;

  @ApiProperty({ description: 'HubSpot pipeline ID', required: false })
  pipeline?: string;

  @ApiProperty({
    description: 'ISO 8601 close date',
    required: false,
    example: '2026-09-30',
  })
  closedate?: string;
}
