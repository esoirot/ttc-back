import { ApiProperty } from '@nestjs/swagger';

export class SetCredentialsDto {
  @ApiProperty({
    description:
      'Clockify personal API key, found in Clockify profile settings',
    example: 'YWJjZGVmZ2hpamtsbW5vcA',
  })
  apiKey!: string;

  @ApiProperty({
    description:
      'Clockify workspace ID to select immediately; omit to select later via PATCH /clockify/workspace',
    required: false,
    example: '5f9c1a2b3c4d5e6f7a8b9c0d',
  })
  workspaceId?: string;
}
