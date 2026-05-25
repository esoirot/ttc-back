import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  InvoiceRepository,
  InvoiceConnectionModel,
} from './invoice.repository';
import { InvoiceModel, InvoiceItemModel } from '../types/invoice.type';
import {
  CreateInvoiceInput,
  AddInvoiceItemInput,
  UpdateInvoiceItemInput,
} from '../dto/create-invoice.input';
import { UpdateInvoiceInput } from '../dto/update-invoice.input';
import { GenerateInvoiceInput } from '../dto/generate-invoice.input';
import { InvoiceStatus as PrismaInvoiceStatus } from '../../generated/prisma/client';
import { InvoiceStatus } from '../entities/invoice.entity';

function decimalToNumber(d: { toNumber(): number } | null): number {
  return d?.toNumber() ?? 0;
}

function itemToModel(item: {
  id: number;
  invoiceId: number;
  projectId: number | null;
  timeEntryId: number | null;
  description: string;
  quantity: { toNumber(): number };
  unitPrice: { toNumber(): number };
  total: { toNumber(): number };
}): InvoiceItemModel {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    projectId: item.projectId,
    timeEntryId: item.timeEntryId,
    description: item.description,
    quantity: decimalToNumber(item.quantity),
    unitPrice: decimalToNumber(item.unitPrice),
    total: decimalToNumber(item.total),
  };
}

function invoiceToModel(inv: {
  id: number;
  userId: number;
  clientId: number | null;
  number: string;
  status: PrismaInvoiceStatus;
  currency: string;
  issuedAt: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: {
    id: number;
    invoiceId: number;
    projectId: number | null;
    timeEntryId: number | null;
    description: string;
    quantity: { toNumber(): number };
    unitPrice: { toNumber(): number };
    total: { toNumber(): number };
  }[];
}): InvoiceModel {
  return {
    ...inv,
    items: inv.items?.map(itemToModel),
  };
}

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nextNumber(userId: number): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { userId, number: { startsWith: `INV-${year}-` } },
    });
    return `INV-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  async findById(id: number, userId: number): Promise<InvoiceModel> {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return invoiceToModel(inv);
  }

  async findAll(
    userId: number,
    status?: string,
    pagination?: { limit?: number; cursor?: number },
    clientId?: number,
    search?: string,
  ): Promise<InvoiceConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = {
      userId,
      ...(status ? { status: status as unknown as PrismaInvoiceStatus } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' as const } },
              { notes: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.prisma.invoice.findMany({
      where,
      include: { items: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const total = await this.prisma.invoice.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items: items.map(invoiceToModel), nextCursor, total };
  }

  async create(
    userId: number,
    number: string,
    data: CreateInvoiceInput,
  ): Promise<InvoiceModel> {
    const inv = await this.prisma.invoice.create({
      data: {
        userId,
        number,
        clientId: data.clientId,
        currency: data.currency ?? 'EUR',
        dueDate: data.dueDate,
        notes: data.notes,
      },
      include: { items: true },
    });
    return invoiceToModel(inv);
  }

  async generate(
    userId: number,
    number: string,
    data: GenerateInvoiceInput,
  ): Promise<InvoiceModel> {
    const project = await this.prisma.project.findUnique({
      where: { id: data.projectId },
      select: {
        fixedFee: true,
        hourlyRate: true,
        perWordRate: true,
        wordCount: true,
        unitPrice: true,
      },
    });

    const fixedFee = project?.fixedFee?.toNumber() ?? null;
    const hourlyRate =
      project?.hourlyRate?.toNumber() ?? project?.unitPrice?.toNumber() ?? null;
    const perWordRate = project?.perWordRate?.toNumber() ?? null;
    const wordCount = project?.wordCount ?? 0;

    type ItemCreate = {
      projectId: number;
      timeEntryId?: number;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    };

    const lineItems: ItemCreate[] = [];

    if (fixedFee != null && fixedFee > 0) {
      lineItems.push({
        projectId: data.projectId,
        description: 'Fixed fee',
        quantity: 1,
        unitPrice: fixedFee,
        total: fixedFee,
      });
    }

    if (hourlyRate != null) {
      const entries = await this.prisma.timeEntry.findMany({
        where: {
          userId,
          projectId: data.projectId,
          billable: true,
          endTime: { not: null },
        },
      });
      for (const e of entries) {
        const qty = (e.durationSeconds ?? 0) / 3600;
        lineItems.push({
          projectId: data.projectId,
          timeEntryId: e.id,
          description: e.description ?? 'Time tracked',
          quantity: qty,
          unitPrice: hourlyRate,
          total: qty * hourlyRate,
        });
      }
    }

    if (perWordRate != null && perWordRate > 0 && wordCount > 0) {
      lineItems.push({
        projectId: data.projectId,
        description: 'Word count',
        quantity: wordCount,
        unitPrice: perWordRate,
        total: wordCount * perWordRate,
      });
    }

    const inv = await this.prisma.invoice.create({
      data: {
        userId,
        number,
        clientId: data.clientId,
        currency: data.currency ?? 'EUR',
        dueDate: data.dueDate,
        items: { create: lineItems },
      },
      include: { items: true },
    });
    return invoiceToModel(inv);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateInvoiceInput,
  ): Promise<InvoiceModel> {
    const inv = await this.prisma.invoice.findFirst({ where: { id, userId } });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);

    const { id: _id, status, ...rest } = data;

    if (status) {
      const allowed: Record<string, string[]> = {
        DRAFT: ['SENT', 'CANCELLED'],
        SENT: ['PAID', 'OVERDUE'],
        PAID: [],
        OVERDUE: ['PAID'],
        CANCELLED: [],
      };
      const current = inv.status as string;
      if (!allowed[current]?.includes(status)) {
        throw new BadRequestException(
          `Cannot transition from ${current} to ${status}`,
        );
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...rest,
        ...(status ? { status: status } : {}),
        ...(status === InvoiceStatus.SENT ? { issuedAt: new Date() } : {}),
        ...(status === InvoiceStatus.PAID && !rest.paidAt
          ? { paidAt: new Date() }
          : {}),
      },
      include: { items: true },
    });
    return invoiceToModel(updated);
  }

  async delete(id: number, userId: number): Promise<InvoiceModel> {
    const inv = await this.prisma.invoice.findFirst({ where: { id, userId } });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    if (inv.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT invoices can be deleted');
    const deleted = await this.prisma.invoice.delete({
      where: { id },
      include: { items: true },
    });
    return invoiceToModel(deleted);
  }

  async addItem(data: AddInvoiceItemInput): Promise<InvoiceItemModel> {
    const total = data.quantity * data.unitPrice;
    const item = await this.prisma.invoiceItem.create({
      data: {
        invoiceId: data.invoiceId,
        projectId: data.projectId,
        timeEntryId: data.timeEntryId,
        description: data.description ?? '',
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total,
      },
    });
    return itemToModel(item);
  }

  async updateItem(
    id: number,
    data: UpdateInvoiceItemInput,
  ): Promise<InvoiceItemModel> {
    const existing = await this.prisma.invoiceItem.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`InvoiceItem ${id} not found`);
    const quantity = data.quantity ?? decimalToNumber(existing.quantity);
    const unitPrice = data.unitPrice ?? decimalToNumber(existing.unitPrice);
    const updated = await this.prisma.invoiceItem.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      },
    });
    return itemToModel(updated);
  }

  async removeItem(id: number): Promise<boolean> {
    const item = await this.prisma.invoiceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`InvoiceItem ${id} not found`);
    await this.prisma.invoiceItem.delete({ where: { id } });
    return true;
  }
}
