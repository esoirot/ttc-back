import { Module } from '@nestjs/common';
import { TimerEventsService } from './timer-events.service';
import { TimerEventsController } from './timer-events.controller';

@Module({
  providers: [TimerEventsService],
  controllers: [TimerEventsController],
  exports: [TimerEventsService],
})
export class TimerEventsModule {}
