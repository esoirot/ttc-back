import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { ClockifyService } from './clockify.service.js';
import { ClockifyController } from './clockify.controller.js';

@Module({
  imports: [UsersModule],
  providers: [ClockifyService],
  controllers: [ClockifyController],
})
export class ClockifyModule {}
