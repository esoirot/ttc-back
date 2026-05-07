import { Injectable } from '@nestjs/common';
import { ProjectRepository } from './repositories/projects.repository';
import { ProjectModel } from './types/project.type';
import { UpdateProjectInput } from './dto/update-project.input';
import { CreateProjectInput } from './dto/create-project.input';
import { DeleteProjectResponse } from './types/delete-project.response';

@Injectable()
export class ProjectsService {
  constructor(private readonly repo: ProjectRepository) {}

  async create(input: CreateProjectInput): Promise<ProjectModel> {
    return this.repo.create(input);
  }

  async findAll(): Promise<ProjectModel[]> {
    return this.repo.findAll();
  }

  async findOne(id: number): Promise<ProjectModel | null> {
    return this.repo.findById(id);
  }

  async update(id: number, input: UpdateProjectInput): Promise<ProjectModel> {
    return this.repo.update(id, input);
  }

  async delete(id: number): Promise<DeleteProjectResponse> {
    const project = await this.repo.delete(id);
    return { id: project.id };
  }
}
