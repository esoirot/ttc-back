import { Injectable } from '@nestjs/common';
import {
  ProjectRepository,
  ProjectConnectionModel,
} from './repositories/projects.repository';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
import { ProjectModel } from './types/project.type';
import { UpdateProjectInput } from './dto/update-project.input';
import { CreateProjectInput } from './dto/create-project.input';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectRepository,
    private readonly audit: AuditService,
    private readonly clientsService: ClientsService,
  ) {}

  async create(
    userId: number,
    input: CreateProjectInput,
  ): Promise<ProjectModel> {
    // If no activityIds were explicitly given and the project is linked to a
    // client, inherit that client's current activity set. An explicit
    // activityIds (even []) always overrides inheritance.
    let resolvedInput = input;
    if (input.activityIds === undefined && input.clientId != null) {
      const client = await this.clientsService.findOne(input.clientId, userId);
      resolvedInput = {
        ...input,
        activityIds: client.activities.map((a: { id: number }) => a.id),
      };
    }
    const project = await this.repo.create(userId, resolvedInput);
    this.audit.log(userId, 'PROJECT_CREATE', 'project', {
      projectId: project.id,
      title: project.title,
      status: project.status,
    });
    return project;
  }

  findAll(
    userId: number,
    isAdmin: boolean,
    status?: string,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<ProjectConnectionModel> {
    return this.repo.findAll(userId, isAdmin, status, pagination, search);
  }

  findOne(id: number, userId: number | null): Promise<ProjectModel | null> {
    return this.repo.findById(id, userId);
  }

  async update(
    id: number,
    userId: number,
    input: UpdateProjectInput,
  ): Promise<ProjectModel> {
    const project = await this.repo.update(id, userId, input);
    this.audit.log(userId, 'PROJECT_UPDATE', 'project', {
      projectId: project.id,
      title: project.title,
      status: project.status,
    });
    return project;
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    this.audit.log(userId, 'PROJECT_DELETE', 'project', { projectId: id });
    return true;
  }
}
