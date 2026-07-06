import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Translations' })
  name!: string;

  @ApiProperty({ required: false, example: 'acme.com' })
  domain?: string;

  @ApiProperty({ required: false, example: '+33612345678' })
  phone?: string;

  @ApiProperty({ required: false })
  city?: string;

  @ApiProperty({ required: false, example: 'France' })
  country?: string;
}
