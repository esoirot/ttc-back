import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import { releaseTimeEntries8 } from '../../invoices/repositories/prisma8-invoice.repository';
import { countOf } from '../../prisma8/count';
import { containsPattern } from '../../prisma8/like';
import { toNumeric } from '../../prisma8/numeric';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { ProjectStatus } from '../../projects/entities/project.entity';
import {
  AdminCreateClientInput,
  AdminCreateProjectInput,
  AdminCreateRateInput,
  AdminUpdateClientInput,
  AdminUpdateInvoiceInput,
  AdminUpdateProjectInput,
  AdminUpdateRateInput,
} from '../dto/admin.input';
import {
  AdminClientModel,
  AdminConnectionModel,
  AdminDeleteResultModel,
  AdminInvoiceItemModel,
  AdminInvoiceModel,
  AdminOwnerModel,
  AdminProjectModel,
  AdminRateModel,
  AdminStatsModel,
  AdminTimeEntryModel,
} from '../types/admin.type';
import { AdminRepository } from './admin.repository';

type RateType = 'HOURLY' | 'DAY' | 'PER_WORD' | 'FIXED';
type Page = { limit?: number; cursor?: number };

const DEFAULT_LIMIT = 20;

function toOwner(
  user: { id: number; email: string; name: string | null } | null,
): AdminOwnerModel {
  return user ?? { id: 0, email: 'unknown', name: null };
}

function itemFromDb(item: {
  id: number;
  invoiceId: number;
  projectId: number | null;
  timeEntryId: number | null;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
}): AdminInvoiceItemModel {
  return {
    ...item,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
  };
}

/** One page by ascending id, `total` counted on the unpaged filter. */
async function pageById<R extends { id: number }>(
  base: {
    where(p: (row: { id: { gt(n: number): unknown } }) => unknown): typeof base;
    orderBy(p: (row: { id: { asc(): unknown } }) => unknown): {
      limit(n: number): { all(): PromiseLike<R[]> };
    };
    aggregate: unknown;
  },
  page: Page | undefined,
): Promise<{ rows: R[]; nextCursor: number | null; total: number }> {
  const limit = page?.limit ?? DEFAULT_LIMIT;
  const scoped =
    page?.cursor !== undefined
      ? base.where((r) => r.id.gt(page.cursor!))
      : base;
  const rows = await scoped
    .orderBy((r) => r.id.asc())
    .limit(limit + 1)
    .all();
  const total = await countOf(base);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    rows: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    total,
  };
}

@Injectable()
export class Prisma8AdminRepository implements AdminRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get orm() {
    return this.db.orm.public;
  }

  async getStats(): Promise<AdminStatsModel> {
    const [
      totalUsers,
      totalClients,
      totalProjects,
      totalInvoices,
      revenue,
      time,
    ] = await Promise.all([
      countOf(this.orm.User),
      countOf(this.orm.Client),
      countOf(this.orm.Project),
      countOf(this.orm.Invoice),
      this.orm.InvoiceItem.aggregate((a) => ({ total: a.sum('total') })),
      this.orm.TimeEntry.aggregate((a) => ({
        seconds: a.sum('durationSeconds'),
      })),
    ]);
    return {
      totalUsers,
      totalClients,
      totalProjects,
      totalInvoices,
      totalRevenue: Number(revenue.total ?? 0),
      totalTimeSeconds: time.seconds ?? 0,
    };
  }

  private clientsQuery() {
    return this.orm.Client.include('user', (u) =>
      u.select('id', 'email', 'name'),
    ).include('contacts');
  }

  private clientFromDb(
    r: NonNullable<
      Awaited<
        ReturnType<ReturnType<Prisma8AdminRepository['clientsQuery']>['first']>
      >
    >,
  ): AdminClientModel {
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      legalName: r.legalName,
      email: r.email,
      phone: r.phone,
      company: r.company,
      address: r.address,
      city: r.city,
      country: r.country,
      postalCode: r.postalCode,
      vatNumber: r.vatNumber,
      hubspotId: r.hubspotId,
      notes: r.notes,
      createdAt: fromDb(r.createdAt),
      updatedAt: fromDb(r.updatedAt),
      contacts: r.contacts.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
      })),
      owner: toOwner(r.user),
    };
  }

  async findClients(
    page?: Page,
    search?: string,
  ): Promise<AdminConnectionModel<AdminClientModel>> {
    let base = this.clientsQuery();
    if (search) base = base.where((c) => c.name.ilike(containsPattern(search)));
    const { rows, nextCursor, total } = await pageById(base as never, page);
    return {
      items: (
        rows as Parameters<Prisma8AdminRepository['clientFromDb']>[0][]
      ).map((r) => this.clientFromDb(r)),
      nextCursor,
      total,
    };
  }

  private projectsQuery() {
    return this.orm.Project.include('user', (u) =>
      u.select('id', 'email', 'name'),
    );
  }

  private projectFromDb(
    r: NonNullable<
      Awaited<
        ReturnType<ReturnType<Prisma8AdminRepository['projectsQuery']>['first']>
      >
    >,
  ): AdminProjectModel {
    return {
      id: r.id,
      userId: r.userId,
      clientId: r.clientId,
      title: r.title,
      description: r.description,
      status: r.status,
      sourceLanguage: r.sourceLanguage,
      targetLanguage: r.targetLanguage,
      wordCount: r.wordCount,
      unitPrice: r.unitPrice === null ? null : Number(r.unitPrice),
      currency: r.currency,
      deadline: fromDb(r.deadline),
      startDate: fromDb(r.startDate),
      createdAt: fromDb(r.createdAt),
      updatedAt: fromDb(r.updatedAt),
      owner: r.user ? toOwner(r.user) : null,
    };
  }

  async findProjects(
    page?: Page,
    search?: string,
    status?: ProjectStatus,
  ): Promise<AdminConnectionModel<AdminProjectModel>> {
    let base = this.projectsQuery().where({
      status: status || undefined,
    });
    if (search)
      base = base.where((p) => p.title.ilike(containsPattern(search)));
    const { rows, nextCursor, total } = await pageById(base as never, page);
    return {
      items: (
        rows as Parameters<Prisma8AdminRepository['projectFromDb']>[0][]
      ).map((r) => this.projectFromDb(r)),
      nextCursor,
      total,
    };
  }

  private invoicesQuery() {
    return this.orm.Invoice.include('user', (u) =>
      u.select('id', 'email', 'name'),
    ).include('items');
  }

  private invoiceFromDb(
    r: NonNullable<
      Awaited<
        ReturnType<ReturnType<Prisma8AdminRepository['invoicesQuery']>['first']>
      >
    >,
  ): AdminInvoiceModel {
    return {
      id: r.id,
      userId: r.userId,
      clientId: r.clientId,
      number: r.number,
      status: r.status,
      currency: r.currency,
      issuedAt: fromDb(r.issuedAt),
      dueDate: fromDb(r.dueDate),
      paidAt: fromDb(r.paidAt),
      notes: r.notes,
      createdAt: fromDb(r.createdAt),
      updatedAt: fromDb(r.updatedAt),
      items: r.items.map(itemFromDb),
      owner: toOwner(r.user),
    };
  }

  async findInvoices(
    page?: Page,
    search?: string,
    status?: InvoiceStatus,
  ): Promise<AdminConnectionModel<AdminInvoiceModel>> {
    let base = this.invoicesQuery().where({
      status: status || undefined,
    });
    if (search) {
      const pattern = containsPattern(search);
      base = base.where((i) =>
        or(i.number.ilike(pattern), i.notes.ilike(pattern)),
      );
    }
    const { rows, nextCursor, total } = await pageById(base as never, page);
    return {
      items: (
        rows as Parameters<Prisma8AdminRepository['invoiceFromDb']>[0][]
      ).map((r) => this.invoiceFromDb(r)),
      nextCursor,
      total,
    };
  }

  async findTimeEntries(
    page?: Page,
    userId?: number,
  ): Promise<AdminConnectionModel<AdminTimeEntryModel>> {
    const base = this.orm.TimeEntry.include('user', (u) =>
      u.select('id', 'email', 'name'),
    ).where({ userId });
    const { rows, nextCursor, total } = await pageById(base as never, page);
    type Row = NonNullable<Awaited<ReturnType<typeof base.first>>>;
    return {
      items: (rows as Row[]).map((r) => ({
        id: r.id,
        userId: r.userId,
        projectId: r.projectId,
        description: r.description,
        startTime: fromDb(r.startTime),
        endTime: fromDb(r.endTime),
        durationSeconds: r.durationSeconds,
        billable: r.billable,
        createdAt: fromDb(r.createdAt),
        updatedAt: fromDb(r.updatedAt),
        owner: toOwner(r.user),
      })),
      nextCursor,
      total,
    };
  }

  private ratesQuery() {
    return this.orm.TranslationRate.include('user', (u) =>
      u.select('id', 'email', 'name'),
    );
  }

  private rateFromDb(
    r: NonNullable<
      Awaited<
        ReturnType<ReturnType<Prisma8AdminRepository['ratesQuery']>['first']>
      >
    >,
  ): AdminRateModel {
    return {
      id: r.id,
      userId: r.userId,
      type: r._type,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      description: r.description,
      createdAt: fromDb(r.createdAt),
      updatedAt: fromDb(r.updatedAt),
      owner: toOwner(r.user),
    };
  }

  async findRates(
    type?: string,
  ): Promise<AdminConnectionModel<AdminRateModel>> {
    const base = this.ratesQuery().where({
      _type: (type || undefined) as RateType | undefined,
    });
    const rows = await base.orderBy((r) => r.id.asc()).all();
    return {
      items: rows.map((r) => this.rateFromDb(r)),
      nextCursor: null,
      total: rows.length,
    };
  }

  async createClient(input: AdminCreateClientInput): Promise<AdminClientModel> {
    const client = await this.orm.Client.create({
      ...input,
      updatedAt: nowDb(),
    });
    return this.clientFromDb(
      (await this.clientsQuery().first({ id: client.id }))!,
    );
  }

  async updateClient(
    id: number,
    input: AdminUpdateClientInput,
  ): Promise<AdminClientModel> {
    const { id: _id, ...data } = input;
    const updated = await this.orm.Client.where({ id }).update({
      ...data,
      updatedAt: nowDb(),
    });
    if (!updated) throw new NotFoundException(`Client ${id} not found`);
    return this.clientFromDb((await this.clientsQuery().first({ id }))!);
  }

  async deleteClient(id: number): Promise<AdminDeleteResultModel> {
    if (!(await this.orm.Client.first({ id })))
      throw new NotFoundException(`Client ${id} not found`);
    const [projects, invoices] = await Promise.all([
      countOf(this.orm.Project.where({ clientId: id })),
      countOf(this.orm.Invoice.where({ clientId: id })),
    ]);
    await this.orm.Client.where({ id }).delete();
    return { id, orphanedRecords: projects + invoices };
  }

  async createProject(
    input: AdminCreateProjectInput,
  ): Promise<AdminProjectModel> {
    const { unitPrice, status, ...data } = input;
    const project = await this.orm.Project.create({
      ...data,
      status: status,
      unitPrice:
        unitPrice === undefined ? undefined : toNumeric<14, 8>(unitPrice),
      updatedAt: nowDb(),
    });
    return this.projectFromDb(
      (await this.projectsQuery().first({ id: project.id }))!,
    );
  }

  async updateProject(
    id: number,
    input: AdminUpdateProjectInput,
  ): Promise<AdminProjectModel> {
    const { id: _id, unitPrice, status, deadline, ...data } = input;
    const updated = await this.orm.Project.where({ id }).update({
      ...data,
      status: status,
      unitPrice:
        unitPrice === undefined ? undefined : toNumeric<14, 8>(unitPrice),
      deadline: deadline === undefined ? undefined : toDb(deadline),
      updatedAt: nowDb(),
    });
    if (!updated) throw new NotFoundException(`Project ${id} not found`);
    return this.projectFromDb((await this.projectsQuery().first({ id }))!);
  }

  async deleteProject(id: number): Promise<AdminDeleteResultModel> {
    if (!(await this.orm.Project.first({ id })))
      throw new NotFoundException(`Project ${id} not found`);
    const [entries, items] = await Promise.all([
      countOf(this.orm.TimeEntry.where({ projectId: id })),
      countOf(this.orm.InvoiceItem.where({ projectId: id })),
    ]);
    await this.orm.Project.where({ id }).delete();
    return { id, orphanedRecords: entries + items };
  }

  async updateInvoice(
    id: number,
    input: AdminUpdateInvoiceInput,
  ): Promise<AdminInvoiceModel> {
    const { id: _id, status, dueDate, ...data } = input;
    const updated = await this.orm.Invoice.where({ id }).update({
      ...data,
      status: status,
      dueDate: dueDate === undefined ? undefined : toDb(dueDate),
      updatedAt: nowDb(),
    });
    if (!updated) throw new NotFoundException(`Invoice ${id} not found`);
    return this.invoiceFromDb((await this.invoicesQuery().first({ id }))!);
  }

  async deleteInvoice(id: number): Promise<AdminDeleteResultModel> {
    const invoice = await this.orm.Invoice.include('items').first({ id });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    if (invoice.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT invoices can be deleted');
    await this.db.transaction(async (tx) => {
      await tx.orm.public.Invoice.where({ id }).delete();
      await releaseTimeEntries8(tx, invoice.items);
    });
    return { id };
  }

  async deleteTimeEntry(id: number): Promise<AdminDeleteResultModel> {
    if (!(await this.orm.TimeEntry.where({ id }).delete())) {
      throw new NotFoundException(`TimeEntry ${id} not found`);
    }
    return { id };
  }

  async createRate(input: AdminCreateRateInput): Promise<AdminRateModel> {
    const { type, ...data } = input;
    const rate = await this.orm.TranslationRate.create({
      ...data,
      _type: type,
      updatedAt: nowDb(),
    });
    return this.rateFromDb((await this.ratesQuery().first({ id: rate.id }))!);
  }

  async updateRate(
    id: number,
    input: AdminUpdateRateInput,
  ): Promise<AdminRateModel> {
    const { id: _id, ...data } = input;
    const updated = await this.orm.TranslationRate.where({ id }).update({
      ...data,
      updatedAt: nowDb(),
    });
    if (!updated) throw new NotFoundException(`Rate ${id} not found`);
    return this.rateFromDb((await this.ratesQuery().first({ id }))!);
  }

  async deleteRate(id: number): Promise<AdminDeleteResultModel> {
    if (!(await this.orm.TranslationRate.where({ id }).delete())) {
      throw new NotFoundException(`Rate ${id} not found`);
    }
    return { id };
  }
}
