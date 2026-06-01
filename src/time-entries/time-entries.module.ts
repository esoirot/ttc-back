import { Module } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesResolver } from './time-entries.resolver';
import { TimeEntryRepository } from './repositories/time-entry.repository';
import { PrismaTimeEntryRepository } from './repositories/prisma-time-entry.repository';
import { PrismaService } from '../prisma.service';
import { TimerEventsModule } from '../timer-events/timer-events.module';

@Module({
  imports: [TimerEventsModule],
  providers: [
    TimeEntriesResolver,
    TimeEntriesService,
    PrismaService,
    PrismaTimeEntryRepository,
    { provide: TimeEntryRepository, useClass: PrismaTimeEntryRepository },
  ],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
