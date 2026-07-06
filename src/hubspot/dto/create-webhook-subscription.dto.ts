import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookSubscriptionDto {
  @ApiProperty({
    description: 'HubSpot subscription event type',
    example: 'contact.propertyChange',
  })
  subscriptionType!: string;

  @ApiProperty({
    description:
      'Property to watch — required for propertyChange subscription types',
    required: false,
    example: 'email',
  })
  propertyName?: string;
}
