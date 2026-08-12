import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { OAuthTokenModule } from '../common/oauth-token/oauth-token.module.js';
import { HubspotService } from './hubspot.service.js';
import { HubspotController } from './hubspot.controller.js';

@Module({
  imports: [UsersModule, AuditModule, ClientsModule, OAuthTokenModule],
  providers: [HubspotService],
  controllers: [HubspotController],
})
export class HubspotModule {}
