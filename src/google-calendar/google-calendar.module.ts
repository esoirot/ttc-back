import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { OAuthTokenModule } from '../common/oauth-token/oauth-token.module.js';
import { GoogleCalendarService } from './google-calendar.service.js';
import { GoogleCalendarController } from './google-calendar.controller.js';

@Module({
  imports: [UsersModule, AuditModule, OAuthTokenModule],
  providers: [GoogleCalendarService],
  controllers: [GoogleCalendarController],
})
export class GoogleCalendarModule {}
