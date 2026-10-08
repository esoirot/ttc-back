import { hoursOf, lineAmounts } from '../line-amounts';
import { assertOwned } from '../../prisma8/ownership';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import { countOf } from '../../prisma8/count';
import { containsPattern } from '../../prisma8/like';
import { Prisma8Service, Prisma8Tx } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import {
  AddInvoiceItemInput,
  CreateInvoiceInput,
  UpdateInvoiceItemInput,
} from '../dto/create-invoice.input';
import { GenerateInvoiceInput } from '../dto/generate-invoice.input';
import { UpdateInvoiceInput } from '../dto/update-invoice.input';
import { InvoiceStatus } from '../entities/invoice.entity';
import { InvoiceItemModel, InvoiceModel } from '../types/invoice.type';
import {
  InvoiceConnectionModel,
  InvoiceRepository,
} from './invoice.repository';

type Status = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

const ALLOWED: Record<Status, Status[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PAID', 'OVERDUE'],
  PAID: [],
  OVERDUE: ['PAID'],
  CANCELLED: [],
};

type ItemRow = Omit<InvoiceItemModel, 'quantity' | 'unitPrice' | 'total'> & {
  quantity: string;
  unitPrice: string;
  total: string;
};

function itemFromDb(item: ItemRow): InvoiceItemModel {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    projectId: item.projectId,
    timeEntryId: item.timeEntryId,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
  };
}

type InvoiceRow = Omit<
  InvoiceModel,
  'issuedAt' | 'dueDate' | 'paidAt' | 'createdAt' | 'updatedAt' | 'items'
> & {
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ItemRow[];
};

function invoiceFromDb(inv: InvoiceRow): InvoiceModel {
  return {
    ...inv,
    issuedAt: fromDb(inv.issuedAt),
    dueDate: fromDb(inv.dueDate),
    paidAt: fromDb(inv.paidAt),
    createdAt: fromDb(inv.createdAt),
    updatedAt: fromDb(inv.updatedAt),
    items: inv.items.map(itemFromDb),
  };
}

/** Time entries billed by removed invoice lines become billable again. */
export async function releaseTimeEntries8(
  tx: Prisma8Tx,
  items: { timeEntryId: number | null }[],
): Promise<void> {
  const ids = items.flatMap((i) =>
    i.timeEntryId === null ? [] : [i.timeEntryId],
  );
  await tx.orm.public.TimeEntry.where((e) => e.id.in(ids)).updateAndCount({
    invoicingStatus: 'NO',
  });
}

const date = (d: Date | null | undefined) =>
  d === undefined ? undefined : toDb(d);

@Injectable()
export class Prisma8InvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: Prisma8Service) {}

  private withItems(orm = this.db.orm) {
    return orm.public.Invoice.include('items');
  }

  async nextNumber(userId: number): Promise<string> {
    const prefix = `INV-${new Date().getFullYear()}-`;
    const rows = await this.db.orm.public.Invoice.where({ userId })
      .where((i) => i.number.like(`${prefix}%`))
      .select('number')
      .all();
    // Highest + 1, not count + 1: a deleted draft must not free a number
    // that a later invoice still holds.
    const highest = Math.max(
      0,
      ...rows.map((r) => Number(r.number.slice(prefix.length)) || 0),
    );
    return `${prefix}${String(highest + 1).padStart(3, '0')}`;
  }

  async findById(id: number, userId: number): Promise<InvoiceModel> {
    const inv = await this.withItems().first({ id, userId });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return invoiceFromDb(inv);
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
    let base = this.withItems().where({
      userId,
      status: (status || undefined) as Status | undefined,
      clientId,
    });
    if (search) {
      const pattern = containsPattern(search);
      base = base.where((i) =>
        or(i.number.ilike(pattern), i.notes.ilike(pattern)),
      );
    }
    const page =
      cursor !== undefined ? base.where((i) => i.id.gt(cursor)) : base;
    const rows = await page
      .orderBy((i) => i.id.asc())
      .limit(limit + 1)
      .all();
    const total = await countOf(base);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map(invoiceFromDb),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async create(
    userId: number,
    number: string,
    data: CreateInvoiceInput,
  ): Promise<InvoiceModel> {
    await assertOwned(this.db.orm, userId, 'Client', data.clientId);
    const inv = await this.db.orm.public.Invoice.create({
      userId,
      number,
      clientId: data.clientId,
      currency: data.currency,
      dueDate: date(data.dueDate),
      notes: data.notes,
      updatedAt: nowDb(),
    });
    return invoiceFromDb({ ...inv, items: [] });
  }

  async generate(
    userId: number,
    number: string,
    data: GenerateInvoiceInput,
  ): Promise<InvoiceModel> {
    const project = await this.db.orm.public.Project.first({
      id: data.projectId,
      userId,
    });
    if (!project)
      throw new NotFoundException(`Project ${data.projectId} not found`);
    await assertOwned(this.db.orm, userId, 'Client', data.clientId);

    const num = (d: string | null) => (d === null ? null : Number(d));
    const fixedFee = num(project.fixedFee);
    const hourlyRate = num(project.hourlyRate) ?? num(project.unitPrice);
    const perWordRate = num(project.perWordRate);
    const wordCount = project.wordCount ?? 0;

    type Line = {
      timeEntryId?: number;
      description: string;
      quantity: number;
      unitPrice: number;
    };
    const lines: Line[] = [];
    if ((fixedFee ?? 0) > 0) {
      lines.push({
        description: 'Fixed fee',
        quantity: 1,
        unitPrice: fixedFee!,
      });
    }
    let consumed: number[] = [];
    if (hourlyRate != null) {
      const entries = await this.db.orm.public.TimeEntry.where({
        userId,
        projectId: data.projectId,
        billable: true,
        invoicingStatus: 'NO',
      }).all();
      for (const e of entries) {
        lines.push({
          timeEntryId: e.id,
          description: e.description ?? 'Time tracked',
          quantity: hoursOf(e.durationSeconds ?? 0),
          unitPrice: hourlyRate,
        });
      }
      consumed = entries.map((e) => e.id);
    }
    if ((perWordRate ?? 0) > 0 && wordCount > 0) {
      lines.push({
        description: 'Word count',
        quantity: wordCount,
        unitPrice: perWordRate!,
      });
    }

    if (lines.length === 0)
      throw new BadRequestException(
        'Nothing to invoice: no fixed fee, no unbilled billable time and no word count.',
      );

    const id = await this.db.transaction(async (tx) => {
      const inv = await tx.orm.public.Invoice.create({
        userId,
        number,
        clientId: data.clientId,
        currency: data.currency,
        dueDate: date(data.dueDate),
        updatedAt: nowDb(),
      });
      await tx.orm.public.InvoiceItem.createAll(
        lines.map((l) => ({
          invoiceId: inv.id,
          projectId: data.projectId,
          timeEntryId: l.timeEntryId ?? null,
          description: l.description,
          ...lineAmounts(l.quantity, l.unitPrice),
        })),
      );
      await tx.orm.public.TimeEntry.where((e) =>
        e.id.in(consumed),
      ).updateAndCount({
        invoicingStatus: 'INVOICED',
      });
      return inv.id;
    });
    return this.findById(id, userId);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateInvoiceInput,
  ): Promise<InvoiceModel> {
    const inv = await this.db.orm.public.Invoice.first({ id, userId });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    const { id: _id, status, dueDate, paidAt, ...rest } = data;
    await assertOwned(this.db.orm, userId, 'Client', rest.clientId);
    if (status && !ALLOWED[inv.status].includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${inv.status} to ${status}`,
      );
    }
    const now = new Date();
    await this.db.orm.public.Invoice.where({ id }).update({
      ...rest,
      status: status || undefined,
      dueDate: date(dueDate),
      paidAt: date(paidAt ?? (status === InvoiceStatus.PAID ? now : undefined)),
      issuedAt: status === InvoiceStatus.SENT ? toDb(now) : undefined,
      updatedAt: nowDb(),
    });
    return this.findById(id, userId);
  }

  async delete(id: number, userId: number): Promise<InvoiceModel> {
    const inv = await this.findById(id, userId);
    if (inv.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT invoices can be deleted');
    await this.db.transaction(async (tx) => {
      await tx.orm.public.Invoice.where({ id }).delete();
      await releaseTimeEntries8(tx, inv.items ?? []);
    });
    return inv;
  }

  async addItem(
    data: AddInvoiceItemInput,
    userId: number,
  ): Promise<InvoiceItemModel> {
    const invoice = await this.db.orm.public.Invoice.first({
      id: data.invoiceId,
      userId,
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${data.invoiceId} not found`);
    await assertOwned(this.db.orm, userId, 'Project', data.projectId);
    const item = await this.db.transaction(async (tx) => {
      if (data.timeEntryId != null) {
        const entry = await tx.orm.public.TimeEntry.first({
          id: data.timeEntryId,
          userId,
        });
        if (!entry)
          throw new NotFoundException(
            `TimeEntry ${data.timeEntryId} not found`,
          );
        if (!entry.billable || entry.invoicingStatus !== 'NO') {
          throw new BadRequestException(
            `TimeEntry ${data.timeEntryId} is not invoiceable`,
          );
        }
        await tx.orm.public.TimeEntry.where({ id: entry.id }).update({
          invoicingStatus: 'INVOICED',
        });
      }
      return tx.orm.public.InvoiceItem.create({
        invoiceId: data.invoiceId,
        projectId: data.projectId,
        timeEntryId: data.timeEntryId,
        description: data.description ?? '',
        ...lineAmounts(data.quantity, data.unitPrice),
      });
    });
    return itemFromDb(item);
  }

  private async ownItem(id: number, userId: number) {
    const item = await this.db.orm.public.InvoiceItem.where((i) =>
      i.invoice.some((inv) => inv.userId.eq(userId)),
    ).first({ id });
    if (!item) throw new NotFoundException(`InvoiceItem ${id} not found`);
    return item;
  }

  async updateItem(
    id: number,
    data: UpdateInvoiceItemInput,
    userId: number,
  ): Promise<InvoiceItemModel> {
    const existing = await this.ownItem(id, userId);
    const quantity = data.quantity ?? Number(existing.quantity);
    const unitPrice = data.unitPrice ?? Number(existing.unitPrice);
    const item = await this.db.orm.public.InvoiceItem.where({ id }).update({
      description: data.description,
      ...lineAmounts(quantity, unitPrice),
    });
    return itemFromDb(item!);
  }

  async removeItem(id: number, userId: number): Promise<boolean> {
    const item = await this.ownItem(id, userId);
    await this.db.transaction(async (tx) => {
      await tx.orm.public.InvoiceItem.where({ id }).delete();
      await releaseTimeEntries8(tx, [item]);
    });
    return true;
  }
}
