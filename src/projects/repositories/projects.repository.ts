import { CreateProjectInput } from '../dto/create-project.input';
import { UpdateProjectInput } from '../dto/update-project.input';
import { ProjectModel } from '../types/project.type';

export abstract class ProjectRepository {
  abstract findById(id: number): Promise<ProjectModel>;
  abstract findAll(): Promise<ProjectModel[]>;
  abstract create(data: CreateProjectInput): Promise<ProjectModel>;
  abstract update(id: number, data: UpdateProjectInput): Promise<ProjectModel>;
  abstract delete(id: number): Promise<ProjectModel>;
}
