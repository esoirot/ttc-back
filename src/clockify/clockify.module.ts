import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { TimeEntriesModule } from '../time-entries/time-entries.module.js';
import { ClockifyService } from './clockify.service.js';
import { ClockifyController } from './clockify.controller.js';

@Module({
  imports: [UsersModule, AuditModule, TimeEntriesModule],
  providers: [ClockifyService],
  controllers: [ClockifyController],
})
export class ClockifyModule {}
