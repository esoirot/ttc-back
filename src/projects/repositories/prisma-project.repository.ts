import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ProjectRepository,
  ProjectConnectionModel,
} from './projects.repository';
import { PrismaService } from '../../prisma.service';
import { ProjectModel } from '../types/project.type';
import { CreateProjectInput } from '../dto/create-project.input';
import { UpdateProjectInput } from '../dto/update-project.input';
import { ProjectStatus } from '../../generated/prisma/client';

function toModel(p: {
  id: number;
  userId: number | null;
  clientId: number | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  wordCount: number | null;
  unitPrice: { toNumber(): number } | null;
  fixedFee: { toNumber(): number } | null;
  hourlyRate: { toNumber(): number } | null;
  perWordRate: { toNumber(): number } | null;
  currency: string;
  deadline: Date | null;
  startDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectModel {
  return {
    ...p,
    unitPrice: p.unitPrice?.toNumber() ?? null,
    fixedFee: p.fixedFee?.toNumber() ?? null,
    hourlyRate: p.hourlyRate?.toNumber() ?? null,
    perWordRate: p.perWordRate?.toNumber() ?? null,
  };
}

@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number, userId: number | null): Promise<ProjectModel> {
    const where = userId !== null ? { id, userId } : { id };
    const project = await this.prisma.project.findFirst({ where });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return toModel(project);
  }

  async findAll(
    userId: number,
    isAdmin: boolean,
    status?: string,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<ProjectConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = {
      ...(isAdmin ? {} : { userId }),
      ...(status ? { status: status as ProjectStatus } : {}),
      ...(search
        ? { title: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.prisma.project.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const total = await this.prisma.project.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items: items.map(toModel), nextCursor, total };
  }

  async create(
    userId: number,
    data: CreateProjectInput,
  ): Promise<ProjectModel> {
    const { unitPrice, fixedFee, hourlyRate, perWordRate, ...rest } = data;
    const project = await this.prisma.project.create({
      data: {
        ...rest,
        userId,
        ...(unitPrice != null ? { unitPrice } : {}),
        ...(fixedFee != null ? { fixedFee } : {}),
        ...(hourlyRate != null ? { hourlyRate } : {}),
        ...(perWordRate != null ? { perWordRate } : {}),
        currency: data.currency ?? 'EUR',
        status: (data.status as ProjectStatus | undefined) ?? 'DRAFT',
      },
    });
    return toModel(project);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateProjectInput,
  ): Promise<ProjectModel> {
    const {
      id: _id,
      unitPrice,
      fixedFee,
      hourlyRate,
      perWordRate,
      ...rest
    } = data;
    const existing = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Project ${id} not found`);
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(unitPrice !== undefined ? { unitPrice } : {}),
        ...(fixedFee !== undefined ? { fixedFee } : {}),
        ...(hourlyRate !== undefined ? { hourlyRate } : {}),
        ...(perWordRate !== undefined ? { perWordRate } : {}),
        ...(rest.status ? { status: rest.status } : {}),
      },
    });
    return toModel(project);
  }

  async delete(id: number, userId: number): Promise<ProjectModel> {
    const existing = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Project ${id} not found`);
    const project = await this.prisma.project.delete({ where: { id } });
    return toModel(project);
  }
}
