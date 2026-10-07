import { Injectable, NotFoundException } from '@nestjs/common';
import { occupationFromDb } from '../../occupations/repositories/prisma8-occupation.mapper';
import { countOf } from '../../prisma8/count';
import { containsPattern } from '../../prisma8/like';
import { toNumeric } from '../../prisma8/numeric';
import { Prisma8Service, Prisma8Tx } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { CreateProjectInput } from '../dto/create-project.input';
import { UpdateProjectInput } from '../dto/update-project.input';
import { ProjectModel } from '../types/project.type';
import {
  ProjectConnectionModel,
  ProjectRepository,
} from './projects.repository';

type ProjectStatus = ProjectModel['status'] &
  (
    | 'DRAFT'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'ARCHIVED'
    | 'INVOICE_SENT'
    | 'INVOICE_PAID'
  );

const numberOrNull = (d: string | null) => (d === null ? null : Number(d));
const date = (d: Date | null | undefined) =>
  d === undefined ? undefined : toDb(d);

@Injectable()
export class Prisma8ProjectRepository implements ProjectRepository {
  constructor(private readonly db: Prisma8Service) {}

  private withOccupations(orm = this.db.orm) {
    return orm.public.Project.include('occupations', (o) =>
      o.include('occupation'),
    );
  }

  private toModel(
    row: Awaited<
      ReturnType<
        ReturnType<Prisma8ProjectRepository['withOccupations']>['first']
      >
    > &
      object,
  ): ProjectModel {
    const { occupations, ...p } = row;
    return {
      ...p,
      unitPrice: numberOrNull(p.unitPrice),
      fixedFee: numberOrNull(p.fixedFee),
      hourlyRate: numberOrNull(p.hourlyRate),
      perWordRate: numberOrNull(p.perWordRate),
      deadline: fromDb(p.deadline),
      startDate: fromDb(p.startDate),
      createdAt: fromDb(p.createdAt),
      updatedAt: fromDb(p.updatedAt),
      occupations: occupations.map((o) => occupationFromDb(o.occupation)),
    } as ProjectModel;
  }

  private async link(
    tx: Prisma8Tx,
    projectId: number,
    occupationIds: number[],
  ) {
    if (occupationIds.length === 0) return;
    await tx.orm.public.ProjectOccupation.createAll(
      occupationIds.map((occupationId) => ({ projectId, occupationId })),
    );
  }

  async findById(id: number, userId: number | null): Promise<ProjectModel> {
    const project = await this.withOccupations().first(
      userId !== null ? { id, userId } : { id },
    );
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return this.toModel(project);
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
    let base = this.withOccupations();
    if (!isAdmin) base = base.where({ userId });
    if (status) base = base.where({ status: status as ProjectStatus });
    if (search)
      base = base.where((p) => p.title.ilike(containsPattern(search)));

    const page =
      cursor !== undefined ? base.where((p) => p.id.gt(cursor)) : base;
    const rows = await page
      .orderBy((p) => p.id.asc())
      .limit(limit + 1)
      .all();
    const total = await countOf(base);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => this.toModel(r)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async create(
    userId: number,
    data: CreateProjectInput,
  ): Promise<ProjectModel> {
    const {
      unitPrice,
      fixedFee,
      hourlyRate,
      perWordRate,
      occupationIds,
      deadline,
      startDate,
      ...rest
    } = data;
    // Inheriting a linked client's occupations (when occupationIds is omitted)
    // is resolved by the caller (ProjectsService.create) before this is
    // reached — this method only ever writes whatever ids it's given.
    const id = await this.db.transaction(async (tx) => {
      const project = await tx.orm.public.Project.create({
        ...rest,
        userId,
        unitPrice: unitPrice != null ? toNumeric(unitPrice) : undefined,
        fixedFee: fixedFee != null ? toNumeric(fixedFee) : undefined,
        hourlyRate: hourlyRate != null ? toNumeric(hourlyRate) : undefined,
        perWordRate: perWordRate != null ? toNumeric(perWordRate) : undefined,
        deadline: date(deadline),
        startDate: date(startDate),
        currency: data.currency ?? 'EUR',
        status: (data.status as ProjectStatus | undefined) ?? 'DRAFT',
        updatedAt: nowDb(),
      });
      await this.link(tx, project.id, occupationIds ?? []);
      return project.id;
    });
    return this.findById(id, userId);
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
      occupationIds,
      deadline,
      startDate,
      ...rest
    } = data;
    await this.findById(id, userId);
    await this.db.transaction(async (tx) => {
      await tx.orm.public.Project.where({ id }).update({
        ...rest,
        status: (rest.status as ProjectStatus | undefined) || undefined,
        unitPrice: unitPrice === undefined ? undefined : toNumeric(unitPrice),
        fixedFee: fixedFee === undefined ? undefined : toNumeric(fixedFee),
        hourlyRate:
          hourlyRate === undefined ? undefined : toNumeric(hourlyRate),
        perWordRate:
          perWordRate === undefined ? undefined : toNumeric(perWordRate),
        deadline: date(deadline),
        startDate: date(startDate),
        updatedAt: nowDb(),
      });
      if (occupationIds !== undefined) {
        await tx.orm.public.ProjectOccupation.where({
          projectId: id,
        }).deleteAndCount();
        await this.link(tx, id, occupationIds);
      }
    });
    return this.findById(id, userId);
  }

  async delete(id: number, userId: number): Promise<ProjectModel> {
    const project = await this.findById(id, userId);
    await this.db.orm.public.Project.where({ id }).delete();
    return project;
  }
}
