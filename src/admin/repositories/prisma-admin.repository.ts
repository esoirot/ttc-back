import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AdminRepository } from './admin.repository';
import {
  AdminStatsModel,
  AdminClientModel,
  AdminProjectModel,
  AdminInvoiceModel,
  AdminTimeEntryModel,
  AdminRateModel,
  AdminConnectionModel,
  AdminDeleteResultModel,
  AdminOwnerModel,
  AdminContactModel,
  AdminInvoiceItemModel,
} from '../types/admin.type';
import {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  AdminCreateProjectInput,
  AdminUpdateProjectInput,
  AdminUpdateInvoiceInput,
  AdminCreateRateInput,
  AdminUpdateRateInput,
} from '../dto/admin.input';
import {
  ProjectStatus,
  InvoiceStatus,
  RateType,
} from '../../generated/prisma/client';

const DEFAULT_LIMIT = 20;

const OWNER_SELECT = {
  select: { id: true, email: true, name: true },
} as const;

function toOwner(
  user: { id: number; email: string; name: string | null } | null,
): AdminOwnerModel {
  return user ?? { id: 0, email: 'unknown', name: null };
}

function decimalToNum(d: { toNumber(): number } | null): number {
  return d?.toNumber() ?? 0;
}

function toItemModel(item: {
  id: number;
  invoiceId: number;
  projectId: number | null;
  timeEntryId: number | null;
  description: string;
  quantity: { toNumber(): number };
  unitPrice: { toNumber(): number };
  total: { toNumber(): number };
}): AdminInvoiceItemModel {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    projectId: item.projectId,
    timeEntryId: item.timeEntryId,
    description: item.description,
    quantity: decimalToNum(item.quantity),
    unitPrice: decimalToNum(item.unitPrice),
    total: decimalToNum(item.total),
  };
}

@Injectable()
export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStatsModel> {
    const [
      totalUsers,
      totalClients,
      totalProjects,
      totalInvoices,
      revenueAgg,
      timeAgg,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.client.count(),
      this.prisma.project.count(),
      this.prisma.invoice.count(),
      this.prisma.invoiceItem.aggregate({ _sum: { total: true } }),
      this.prisma.timeEntry.aggregate({ _sum: { durationSeconds: true } }),
    ]);
    return {
      totalUsers,
      totalClients,
      totalProjects,
      totalInvoices,
      totalRevenue: revenueAgg._sum.total?.toNumber() ?? 0,
      totalTimeSeconds: timeAgg._sum.durationSeconds ?? 0,
    };
  }

  async findClients(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<AdminConnectionModel<AdminClientModel>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = pagination?.cursor;
    const searchFilter = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};
    const where = {
      ...searchFilter,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        take: limit + 1,
        orderBy: { id: 'asc' },
        include: { user: OWNER_SELECT, contacts: true },
      }),
      this.prisma.client.count({ where: searchFilter }),
    ]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
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
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        contacts: r.contacts.map(
          (c): AdminContactModel => ({
            id: c.id,
            clientId: c.clientId,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
          }),
        ),
        owner: toOwner(r.user),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async findProjects(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    status?: ProjectStatus,
  ): Promise<AdminConnectionModel<AdminProjectModel>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = pagination?.cursor;
    const searchFilter = search
      ? { title: { contains: search, mode: 'insensitive' as const } }
      : {};
    const statusFilter = status ? { status } : {};
    const baseWhere = { ...searchFilter, ...statusFilter };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        take: limit + 1,
        orderBy: { id: 'asc' },
        include: { user: OWNER_SELECT },
      }),
      this.prisma.project.count({ where: baseWhere }),
    ]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        userId: r.userId,
        clientId: r.clientId,
        title: r.title,
        description: r.description,
        status: r.status,
        sourceLanguage: r.sourceLanguage,
        targetLanguage: r.targetLanguage,
        wordCount: r.wordCount,
        unitPrice: r.unitPrice?.toNumber() ?? null,
        currency: r.currency,
        deadline: r.deadline,
        startDate: r.startDate,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: r.user ? toOwner(r.user) : null,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async findInvoices(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    status?: InvoiceStatus,
  ): Promise<AdminConnectionModel<AdminInvoiceModel>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = pagination?.cursor;
    const searchFilter = search
      ? {
          OR: [
            { number: { contains: search, mode: 'insensitive' as const } },
            { notes: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const statusFilter = status ? { status } : {};
    const baseWhere = { ...searchFilter, ...statusFilter };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        take: limit + 1,
        orderBy: { id: 'asc' },
        include: { user: OWNER_SELECT, items: true },
      }),
      this.prisma.invoice.count({ where: baseWhere }),
    ]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        userId: r.userId,
        clientId: r.clientId,
        number: r.number,
        status: r.status,
        currency: r.currency,
        issuedAt: r.issuedAt,
        dueDate: r.dueDate,
        paidAt: r.paidAt,
        notes: r.notes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        items: r.items.map(toItemModel),
        owner: toOwner(r.user),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async findTimeEntries(
    pagination?: { limit?: number; cursor?: number },
    userId?: number,
  ): Promise<AdminConnectionModel<AdminTimeEntryModel>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = pagination?.cursor;
    const baseWhere = userId !== undefined ? { userId } : {};
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        take: limit + 1,
        orderBy: { id: 'asc' },
        include: { user: OWNER_SELECT },
      }),
      this.prisma.timeEntry.count({ where: baseWhere }),
    ]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        userId: r.userId,
        projectId: r.projectId,
        description: r.description,
        startTime: r.startTime,
        endTime: r.endTime,
        durationSeconds: r.durationSeconds,
        billable: r.billable,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: toOwner(r.user),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async findRates(
    type?: RateType,
  ): Promise<AdminConnectionModel<AdminRateModel>> {
    const where = type ? { type } : {};
    const [rows, total] = await Promise.all([
      this.prisma.rate.findMany({
        where,
        orderBy: { id: 'asc' },
        include: { user: OWNER_SELECT },
      }),
      this.prisma.rate.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        name: r.name,
        amount: r.amount,
        currency: r.currency,
        description: r.description,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: toOwner(r.user),
      })),
      nextCursor: null,
      total,
    };
  }

  async createClient(input: AdminCreateClientInput): Promise<AdminClientModel> {
    const { userId, ...data } = input;
    const r = await this.prisma.client.create({
      data: { userId, ...data },
      include: { user: OWNER_SELECT, contacts: true },
    });
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
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      contacts: [],
      owner: toOwner(r.user),
    };
  }

  async updateClient(
    id: number,
    input: AdminUpdateClientInput,
  ): Promise<AdminClientModel> {
    try {
      const { id: _id, ...data } = input;
      const r = await this.prisma.client.update({
        where: { id },
        data,
        include: { user: OWNER_SELECT, contacts: true },
      });
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
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        contacts: r.contacts.map(
          (c): AdminContactModel => ({
            id: c.id,
            clientId: c.clientId,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
          }),
        ),
        owner: toOwner(r.user),
      };
    } catch {
      throw new NotFoundException(`Client ${id} not found`);
    }
  }

  async deleteClient(id: number): Promise<AdminDeleteResultModel> {
    try {
      await this.prisma.client.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException(`Client ${id} not found`);
    }
  }

  async createProject(
    input: AdminCreateProjectInput,
  ): Promise<AdminProjectModel> {
    const { userId, ...data } = input;
    const r = await this.prisma.project.create({
      data: { userId, ...data },
      include: { user: OWNER_SELECT },
    });
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
      unitPrice: r.unitPrice?.toNumber() ?? null,
      currency: r.currency,
      deadline: r.deadline,
      startDate: r.startDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      owner: r.user ? toOwner(r.user) : null,
    };
  }

  async updateProject(
    id: number,
    input: AdminUpdateProjectInput,
  ): Promise<AdminProjectModel> {
    try {
      const { id: _id, ...data } = input;
      const r = await this.prisma.project.update({
        where: { id },
        data,
        include: { user: OWNER_SELECT },
      });
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
        unitPrice: r.unitPrice?.toNumber() ?? null,
        currency: r.currency,
        deadline: r.deadline,
        startDate: r.startDate,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: r.user ? toOwner(r.user) : null,
      };
    } catch {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }

  async deleteProject(id: number): Promise<AdminDeleteResultModel> {
    try {
      await this.prisma.project.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }

  private async invoiceWithOwner(id: number): Promise<AdminInvoiceModel> {
    const r = await this.prisma.invoice.findUnique({
      where: { id },
      include: { user: OWNER_SELECT, items: true },
    });
    if (!r) throw new NotFoundException(`Invoice ${id} not found`);
    return {
      id: r.id,
      userId: r.userId,
      clientId: r.clientId,
      number: r.number,
      status: r.status,
      currency: r.currency,
      issuedAt: r.issuedAt,
      dueDate: r.dueDate,
      paidAt: r.paidAt,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      items: r.items.map(toItemModel),
      owner: toOwner(r.user),
    };
  }

  async updateInvoice(
    id: number,
    input: AdminUpdateInvoiceInput,
  ): Promise<AdminInvoiceModel> {
    try {
      const { id: _id, ...data } = input;
      await this.prisma.invoice.update({ where: { id }, data });
      return this.invoiceWithOwner(id);
    } catch {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
  }

  async deleteInvoice(id: number): Promise<AdminDeleteResultModel> {
    try {
      await this.prisma.invoice.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
  }

  async deleteTimeEntry(id: number): Promise<AdminDeleteResultModel> {
    try {
      await this.prisma.timeEntry.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException(`TimeEntry ${id} not found`);
    }
  }

  async createRate(input: AdminCreateRateInput): Promise<AdminRateModel> {
    const { userId, ...data } = input;
    const r = await this.prisma.rate.create({
      data: { userId, ...data },
      include: { user: OWNER_SELECT },
    });
    return {
      id: r.id,
      userId: r.userId,
      type: r.type,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      owner: toOwner(r.user),
    };
  }

  async updateRate(
    id: number,
    input: AdminUpdateRateInput,
  ): Promise<AdminRateModel> {
    try {
      const { id: _id, ...data } = input;
      const r = await this.prisma.rate.update({
        where: { id },
        data,
        include: { user: OWNER_SELECT },
      });
      return {
        id: r.id,
        userId: r.userId,
        type: r.type,
        name: r.name,
        amount: r.amount,
        currency: r.currency,
        description: r.description,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: toOwner(r.user),
      };
    } catch {
      throw new NotFoundException(`Rate ${id} not found`);
    }
  }

  async deleteRate(id: number): Promise<AdminDeleteResultModel> {
    try {
      await this.prisma.rate.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException(`Rate ${id} not found`);
    }
  }
}
