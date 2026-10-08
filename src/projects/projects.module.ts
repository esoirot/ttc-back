import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsResolver } from './projects.resolver';
import { ProjectRepository } from './repositories/projects.repository';
import { Prisma8ProjectRepository } from './repositories/prisma8-project.repository';
import { AuditModule } from '../audit/audit.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [AuditModule, ClientsModule],
  providers: [
    ProjectsResolver,
    ProjectsService,
    { provide: ProjectRepository, useClass: Prisma8ProjectRepository },
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
