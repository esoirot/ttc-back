import { Module } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesResolver } from './time-entries.resolver';
import { TaskTimeResolver } from './task-time.resolver';
import { TimeEntryRepository } from './repositories/time-entry.repository';
import { Prisma8TimeEntryRepository } from './repositories/prisma8-time-entry.repository';
import { TimerEventsModule } from '../timer-events/timer-events.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TimerEventsModule, TasksModule],
  providers: [
    TimeEntriesResolver,
    TaskTimeResolver,
    TimeEntriesService,
    { provide: TimeEntryRepository, useClass: Prisma8TimeEntryRepository },
  ],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
