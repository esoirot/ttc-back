import { ApiProperty } from '@nestjs/swagger';

export class CreateAssociationDto {
  @ApiProperty({ description: 'Source object type', example: 'contacts' })
  fromObjectType!: string;

  @ApiProperty({ description: 'Source object HubSpot ID' })
  fromObjectId!: string;

  @ApiProperty({ description: 'Target object type', example: 'companies' })
  toObjectType!: string;

  @ApiProperty({ description: 'Target object HubSpot ID' })
  toObjectId!: string;

  @ApiProperty({
    description:
      'HubSpot association type ID; defaults to the standard type for the given object type pair if omitted',
    required: false,
  })
  associationTypeId?: number;
}
