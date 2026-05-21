import { CreateProjectInput } from '../dto/create-project.input';
import { UpdateProjectInput } from '../dto/update-project.input';
import { ProjectModel } from '../types/project.type';

export interface ProjectConnectionModel {
  items: ProjectModel[];
  nextCursor: number | null;
  total: number;
}

type PaginationArgs = { limit?: number; cursor?: number };

export abstract class ProjectRepository {
  abstract findById(id: number, userId: number | null): Promise<ProjectModel>;
  abstract findAll(
    userId: number,
    isAdmin: boolean,
    status?: string,
    pagination?: PaginationArgs,
    search?: string,
  ): Promise<ProjectConnectionModel>;
  abstract create(
    userId: number,
    data: CreateProjectInput,
  ): Promise<ProjectModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateProjectInput,
  ): Promise<ProjectModel>;
  abstract delete(id: number, userId: number): Promise<ProjectModel>;
}
