import { ApiProperty } from '@nestjs/swagger';

export class UpdateContactDto {
  @ApiProperty({ required: false, example: 'jane@client.com' })
  email?: string;

  @ApiProperty({ required: false })
  firstname?: string;

  @ApiProperty({ required: false })
  lastname?: string;

  @ApiProperty({ required: false, example: '+33612345678' })
  phone?: string;

  @ApiProperty({
    description: 'Company name (free text, not a HubSpot company ID)',
    required: false,
  })
  company?: string;
}
