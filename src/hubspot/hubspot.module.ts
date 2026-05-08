import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { HubspotService } from './hubspot.service.js';
import { HubspotController } from './hubspot.controller.js';

@Module({
  imports: [UsersModule],
  providers: [HubspotService],
  controllers: [HubspotController],
})
export class HubspotModule {}
