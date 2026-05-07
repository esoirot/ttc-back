import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsResolver } from './projects.resolver';
import { ProjectRepository } from './repositories/projects.repository';
import { PrismaProjectRepository } from './repositories/prisma-project.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    ProjectsResolver,
    ProjectsService,
    PrismaService,
    PrismaProjectRepository,
    {
      provide: ProjectRepository,
      useClass: PrismaProjectRepository,
    },
  ],
})
export class ProjectsModule {}
