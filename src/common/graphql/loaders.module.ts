import { Module } from '@nestjs/common';
import { TasksModule } from '../../tasks/tasks.module';
import { ClientsModule } from '../../clients/clients.module';
import { TimeEntriesModule } from '../../time-entries/time-entries.module';
import { LoadersService } from './loaders.service';

@Module({
  imports: [TasksModule, ClientsModule, TimeEntriesModule],
  providers: [LoadersService],
  exports: [LoadersService],
})
export class GraphqlLoadersModule {}
