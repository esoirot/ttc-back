import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from './projects.repository';
import { PrismaService } from '../../prisma.service';
import { ProjectModel } from '../types/project.type';
import { CreateProjectInput } from '../dto/create-project.input';
import { UpdateProjectInput } from '../dto/update-project.input';

@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<ProjectModel> {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }

    return project;
  }

  async findAll(): Promise<ProjectModel[]> {
    return this.prisma.project.findMany();
  }

  async create(data: CreateProjectInput): Promise<ProjectModel> {
    return this.prisma.project.create({
      data,
    });
  }

  async update(id: number, data: UpdateProjectInput): Promise<ProjectModel> {
    try {
      return await this.prisma.project.update({
        where: { id },
        data,
      });
    } catch {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
  }

  async delete(id: number): Promise<ProjectModel> {
    try {
      return await this.prisma.project.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
  }
}
