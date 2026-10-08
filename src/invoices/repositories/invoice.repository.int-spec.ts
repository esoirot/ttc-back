import { BadRequestException, NotFoundException } from '@nestjs/common';
import { toNumeric } from '../../prisma8/numeric';
import { toDb } from '../../prisma8/timestamp';
import {
  seedClient,
  seedProject,
  seedTimeEntry,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { InvoiceStatus } from '../entities/invoice.entity';
import { InvoiceRepository } from './invoice.repository';
import { Prisma8InvoiceRepository } from './prisma8-invoice.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();
const year = new Date().getFullYear();

describe.each([
  [
    'prisma8',
    (): InvoiceRepository => new Prisma8InvoiceRepository(db.prisma8),
  ],
])('InvoiceRepository (%s)', (_impl, make) => {
  let repo: InvoiceRepository;
  let owner: number;
  let stranger: number;

  const invoiceStatus = (
    id: number,
    status: 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED',
  ) => db.prisma8.orm.public.Invoice.where({ id }).update({ status });
  const entryStatus = async (id: number) =>
    (await db.prisma8.orm.public.TimeEntry.first({ id }))!.invoicingStatus;

  // A third user's sent invoice with a billed line, plus an unbilled entry
  // created first: a write or release that loses its filter lands here.
  const snapshot = async (d: { invoice: number; entries: number[] }) => ({
    invoice: await db.prisma8.orm.public.Invoice.first({ id: d.invoice }),
    items: await db.prisma8.orm.public.InvoiceItem.where({
      invoiceId: d.invoice,
    }).all(),
    entries: await Promise.all(
      d.entries.map((id) => db.prisma8.orm.public.TimeEntry.first({ id })),
    ),
  });
  let decoy: {
    invoice: number;
    entries: number[];
    before: Awaited<ReturnType<typeof snapshot>>;
  };

  beforeEach(async () => {
    repo = make();
    const other = (await seedUser(db.prisma8)).id;
    const unbilled = await seedTimeEntry(db.prisma8, other);
    const billed = await seedTimeEntry(db.prisma8, other, {
      invoicingStatus: 'INVOICED',
    });
    const inv = await db.prisma8.orm.public.Invoice.create({
      userId: other,
      number: 'DECOY',
      status: 'SENT',
      updatedAt: toDb(new Date()),
    });
    await db.prisma8.orm.public.InvoiceItem.create({
      invoiceId: inv.id,
      timeEntryId: billed.id,
      description: 'decoy',
      quantity: toNumeric(1),
      unitPrice: toNumeric(1),
      total: toNumeric(1),
    });
    const ids = { invoice: inv.id, entries: [unbilled.id, billed.id] };
    decoy = { ...ids, before: await snapshot(ids) };
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  afterEach(async () => {
    await expect(snapshot(decoy)).resolves.toEqual(decoy.before);
  });

  describe('nextNumber', () => {
    it('numbers per user and year, from the highest number so far', async () => {
      await expect(repo.nextNumber(owner)).resolves.toBe(`INV-${year}-001`);
      await repo.create(owner, `INV-${year}-001`, {});
      await repo.create(owner, `INV-${year - 1}-007`, {});
      await expect(repo.nextNumber(owner)).resolves.toBe(`INV-${year}-002`);
      await expect(repo.nextNumber(stranger)).resolves.toBe(`INV-${year}-001`);
    });

    it('lets two users each have the same number', async () => {
      await repo.create(owner, `INV-${year}-001`, {});
      await expect(
        repo.create(stranger, `INV-${year}-001`, {}),
      ).resolves.toMatchObject({ userId: stranger, number: `INV-${year}-001` });
    });

    it('never reuses an existing number after a draft in the middle is deleted', async () => {
      await repo.create(owner, `INV-${year}-001`, {});
      const middle = await repo.create(owner, `INV-${year}-002`, {});
      await repo.create(owner, `INV-${year}-003`, {});
      await repo.delete(middle.id, owner);
      await expect(repo.nextNumber(owner)).resolves.toBe(`INV-${year}-004`);
    });
  });

  describe('create / findById', () => {
    it('defaults to a DRAFT EUR invoice with no items', async () => {
      const client = await seedClient(db.prisma8, owner);
      const due = new Date('2026-12-01T00:00:00.000Z');
      const inv = await repo.create(owner, 'INV-A', {
        clientId: client.id,
        dueDate: due,
        notes: 'n',
      });
      expect(inv).toMatchObject({
        userId: owner,
        clientId: client.id,
        number: 'INV-A',
        status: 'DRAFT',
        currency: 'EUR',
        dueDate: due,
        notes: 'n',
        issuedAt: null,
        paidAt: null,
        items: [],
      });
      await expect(repo.findById(inv.id, owner)).resolves.toMatchObject({
        number: 'INV-A',
      });
      await expect(repo.findById(inv.id, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('pages by id with total, filters by status, client and number/notes search', async () => {
      const client = await seedClient(db.prisma8, owner);
      const a = await repo.create(owner, 'INV-2026-001', {
        clientId: client.id,
        notes: 'Game localization',
      });
      const b = await repo.create(owner, 'INV-2026-002', {});
      const c = await repo.create(owner, 'INV-2026-003', { notes: 'website' });
      await repo.create(stranger, 'X-1', {});
      await invoiceStatus(b.id, 'SENT');

      const page1 = await repo.findAll(owner, undefined, { limit: 2 });
      expect(page1.items.map((i) => i.id)).toEqual([a.id, b.id]);
      expect(page1).toMatchObject({ total: 3, nextCursor: b.id });
      const page2 = await repo.findAll(owner, undefined, {
        limit: 2,
        cursor: b.id,
      });
      expect(page2.items.map((i) => i.id)).toEqual([c.id]);

      await expect(repo.findAll(owner, 'SENT')).resolves.toMatchObject({
        total: 1,
        items: [expect.objectContaining({ id: b.id })],
      });
      await expect(
        repo.findAll(owner, undefined, undefined, client.id),
      ).resolves.toMatchObject({ total: 1 });
      await expect(
        repo.findAll(owner, undefined, undefined, undefined, 'GAME'),
      ).resolves.toMatchObject({ total: 1 });
      await expect(
        repo.findAll(owner, undefined, undefined, undefined, '-003'),
      ).resolves.toMatchObject({ total: 1 });
    });
  });

  describe('findAll paging', () => {
    it('has no next cursor when the page holds exactly the limit', async () => {
      await repo.create(owner, 'INV-A', {});
      await repo.create(owner, 'INV-B', {});
      await expect(
        repo.findAll(owner, undefined, { limit: 2 }),
      ).resolves.toMatchObject({ nextCursor: null, total: 2 });
    });
  });

  describe('update', () => {
    it.each([
      ['DRAFT', InvoiceStatus.SENT],
      ['DRAFT', InvoiceStatus.CANCELLED],
      ['SENT', InvoiceStatus.PAID],
      ['SENT', InvoiceStatus.OVERDUE],
      ['OVERDUE', InvoiceStatus.PAID],
    ] as const)('allows %s -> %s', async (from, to) => {
      const inv = await repo.create(owner, 'INV-T', {});
      if (from !== 'DRAFT') await invoiceStatus(inv.id, from);
      await expect(
        repo.update(inv.id, owner, { id: inv.id, status: to }),
      ).resolves.toMatchObject({ status: to });
    });

    it.each([
      ['DRAFT', InvoiceStatus.PAID],
      ['SENT', InvoiceStatus.DRAFT],
      ['PAID', InvoiceStatus.SENT],
      ['CANCELLED', InvoiceStatus.SENT],
    ] as const)('rejects %s -> %s', async (from, to) => {
      const inv = await repo.create(owner, 'INV-T', {});
      if (from !== 'DRAFT') await invoiceStatus(inv.id, from);
      await expect(
        repo.update(inv.id, owner, { id: inv.id, status: to }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stamps issuedAt when sent and paidAt when paid, unless paidAt is given', async () => {
      const inv = await repo.create(owner, 'INV-T', {});
      const sent = await repo.update(inv.id, owner, {
        id: inv.id,
        status: InvoiceStatus.SENT,
      });
      expect(sent.issuedAt).toBeInstanceOf(Date);
      const paid = await repo.update(inv.id, owner, {
        id: inv.id,
        status: InvoiceStatus.PAID,
      });
      expect(paid.paidAt).toBeInstanceOf(Date);

      const other = await repo.create(owner, 'INV-U', {});
      await invoiceStatus(other.id, 'SENT');
      const when = new Date('2026-10-01T12:00:00.000Z');
      await expect(
        repo.update(other.id, owner, {
          id: other.id,
          status: InvoiceStatus.PAID,
          paidAt: when,
        }),
      ).resolves.toMatchObject({ paidAt: when });
    });

    it("updates plain fields, NotFound for someone else's invoice", async () => {
      const inv = await repo.create(owner, 'INV-T', {});
      await expect(
        repo.update(inv.id, owner, {
          id: inv.id,
          notes: 'updated',
          currency: 'USD',
        }),
      ).resolves.toMatchObject({
        notes: 'updated',
        currency: 'USD',
        status: 'DRAFT',
        issuedAt: null,
        paidAt: null,
      });
      await expect(
        repo.update(inv.id, stranger, { id: inv.id, notes: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.findById(inv.id, owner)).resolves.toMatchObject({
        notes: 'updated',
      });
    });
  });

  describe('delete', () => {
    it('releases the time entries of a deleted draft', async () => {
      const project = await seedProject(db.prisma8, owner, {
        hourlyRate: toNumeric(50),
      });
      const entry = await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 3600,
      });
      const draft = await repo.generate(owner, 'INV-G', {
        projectId: project.id,
      });
      await expect(entryStatus(entry.id)).resolves.toBe('INVOICED');

      await repo.delete(draft.id, owner);

      await expect(entryStatus(entry.id)).resolves.toBe('NO');
    });

    it('deletes a draft only, NotFound for someone else', async () => {
      const draft = await repo.create(owner, 'INV-D', {});
      const sent = await repo.create(owner, 'INV-S', {});
      await invoiceStatus(sent.id, 'SENT');
      await expect(repo.delete(sent.id, owner)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(repo.delete(draft.id, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.delete(draft.id, owner)).resolves.toMatchObject({
        id: draft.id,
      });
      await expect(repo.findById(draft.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('items', () => {
    it('defaults a line without description to empty text', async () => {
      const inv = await repo.create(owner, 'INV-I', {});
      await expect(
        repo.addItem({ invoiceId: inv.id, quantity: 1, unitPrice: 1 }, owner),
      ).resolves.toMatchObject({ description: '' });
    });

    it('adds a free item with total = quantity x unitPrice', async () => {
      const inv = await repo.create(owner, 'INV-I', {});
      const item = await repo.addItem(
        {
          invoiceId: inv.id,
          description: 'Proofreading',
          quantity: 2.5,
          unitPrice: 40,
        },
        owner,
      );
      expect(item).toEqual({
        id: anyNumber,
        invoiceId: inv.id,
        projectId: null,
        timeEntryId: null,
        description: 'Proofreading',
        quantity: 2.5,
        unitPrice: 40,
        total: 100,
      });
      await expect(repo.findById(inv.id, owner)).resolves.toMatchObject({
        items: [expect.objectContaining({ total: 100 })],
      });
    });

    it('locks a billable time entry as invoiced, refuses an unbillable or already invoiced one', async () => {
      const inv = await repo.create(owner, 'INV-I', {});
      const entry = await seedTimeEntry(db.prisma8, owner);
      const unbillable = await seedTimeEntry(db.prisma8, owner, {
        billable: false,
      });

      await repo.addItem(
        {
          invoiceId: inv.id,
          timeEntryId: entry.id,
          quantity: 1,
          unitPrice: 50,
        },
        owner,
      );
      await expect(entryStatus(entry.id)).resolves.toBe('INVOICED');

      await expect(
        repo.addItem(
          {
            invoiceId: inv.id,
            timeEntryId: entry.id,
            quantity: 1,
            unitPrice: 50,
          },
          owner,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        repo.addItem(
          {
            invoiceId: inv.id,
            timeEntryId: unbillable.id,
            quantity: 1,
            unitPrice: 50,
          },
          owner,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(repo.findById(inv.id, owner)).resolves.toMatchObject({
        items: [expect.anything()],
      });
    });

    it("refuses someone else's invoice or time entry", async () => {
      const mine = await repo.create(owner, 'INV-I', {});
      const theirs = await repo.create(stranger, 'INV-X', {});
      const theirEntry = await seedTimeEntry(db.prisma8, stranger);
      await expect(
        repo.addItem(
          { invoiceId: theirs.id, quantity: 1, unitPrice: 1 },
          owner,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        repo.addItem(
          {
            invoiceId: mine.id,
            timeEntryId: theirEntry.id,
            quantity: 1,
            unitPrice: 1,
          },
          owner,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(entryStatus(theirEntry.id)).resolves.toBe('NO');
    });

    it('updates an item and recomputes its total from stored values', async () => {
      const inv = await repo.create(owner, 'INV-I', {});
      const item = await repo.addItem(
        { invoiceId: inv.id, description: 'a', quantity: 2, unitPrice: 10 },
        owner,
      );
      await expect(
        repo.updateItem(item.id, { id: item.id, quantity: 3 }, owner),
      ).resolves.toMatchObject({
        description: 'a',
        quantity: 3,
        unitPrice: 10,
        total: 30,
      });
      await expect(
        repo.updateItem(
          item.id,
          { id: item.id, unitPrice: 12.5, description: 'b' },
          owner,
        ),
      ).resolves.toMatchObject({ description: 'b', quantity: 3, total: 37.5 });
      await expect(
        repo.updateItem(item.id, { id: item.id, quantity: 1 }, stranger),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes an item and releases its time entry for billing again', async () => {
      const inv = await repo.create(owner, 'INV-I', {});
      const entry = await seedTimeEntry(db.prisma8, owner);
      const item = await repo.addItem(
        { invoiceId: inv.id, timeEntryId: entry.id, quantity: 1, unitPrice: 1 },
        owner,
      );
      await expect(repo.removeItem(item.id, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(entryStatus(entry.id)).resolves.toBe('INVOICED');
      await expect(repo.removeItem(item.id, owner)).resolves.toBe(true);
      await expect(repo.findById(inv.id, owner)).resolves.toMatchObject({
        items: [],
      });
      await expect(entryStatus(entry.id)).resolves.toBe('NO');
    });
  });

  describe('exact amounts', () => {
    const exact = { quantity: 0.15, unitPrice: 0.359, total: 0.0539 };

    it('adds and updates lines with exact totals (floats would give 0.0538)', async () => {
      const inv = await repo.create(owner, 'INV-1', {});
      const added = await repo.addItem(
        { invoiceId: inv.id, quantity: 0.15, unitPrice: 0.359 },
        owner,
      );
      expect(added).toMatchObject(exact);
      const other = await repo.addItem(
        { invoiceId: inv.id, quantity: 1, unitPrice: 1 },
        owner,
      );
      await expect(
        repo.updateItem(
          other.id,
          { id: other.id, quantity: 0.15, unitPrice: 0.359 },
          owner,
        ),
      ).resolves.toMatchObject(exact);
    });

    it('bills time in hours on 4 decimals, total = shown hours x rate', async () => {
      const project = await seedProject(db.prisma8, owner, {
        hourlyRate: toNumeric(0.359),
      });
      await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 540,
      });
      await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 1200,
      });
      const inv = await repo.generate(owner, 'INV-G', {
        projectId: project.id,
      });
      expect(
        inv.items!.map(({ quantity, total }) => ({ quantity, total })),
      ).toEqual([
        { quantity: 0.15, total: 0.0539 },
        { quantity: 0.3333, total: 0.1197 },
      ]);
    });
  });

  describe('generate', () => {
    it('refuses a project with nothing to invoice and creates nothing', async () => {
      const project = await seedProject(db.prisma8, owner, {
        hourlyRate: toNumeric(60),
      });
      await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 3600,
        billable: false,
      });
      await expect(
        repo.generate(owner, 'INV-G', { projectId: project.id }),
      ).rejects.toThrow(/Nothing to invoice/);
      await expect(
        db.prisma8.orm.public.Invoice.where({ userId: owner }).all(),
      ).resolves.toEqual([]);
    });

    it('builds fixed-fee, time and word-count lines and marks the consumed entries invoiced', async () => {
      const project = await seedProject(db.prisma8, owner, {
        fixedFee: toNumeric(500),
        hourlyRate: toNumeric(60),
        perWordRate: toNumeric(0.1),
        wordCount: 2000,
      });
      const billable = await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 5400,
        description: 'Translation',
      });
      const unbillable = await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 3600,
        billable: false,
      });
      const alreadyBilled = await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 3600,
        invoicingStatus: 'INVOICED',
      });
      const someoneElses = await seedTimeEntry(db.prisma8, stranger, {
        projectId: project.id,
        durationSeconds: 3600,
      });

      const inv = await repo.generate(owner, 'INV-G', {
        projectId: project.id,
        currency: 'USD',
      });

      expect(inv).toMatchObject({
        number: 'INV-G',
        status: 'DRAFT',
        currency: 'USD',
      });
      const lines = inv.items!.map(
        ({ description, quantity, unitPrice, total, timeEntryId }) => ({
          description,
          quantity,
          unitPrice,
          total,
          timeEntryId,
        }),
      );
      expect(lines).toEqual(
        expect.arrayContaining([
          {
            description: 'Fixed fee',
            quantity: 1,
            unitPrice: 500,
            total: 500,
            timeEntryId: null,
          },
          {
            description: 'Translation',
            quantity: 1.5,
            unitPrice: 60,
            total: 90,
            timeEntryId: billable.id,
          },
          {
            description: 'Word count',
            quantity: 2000,
            unitPrice: 0.1,
            total: 200,
            timeEntryId: null,
          },
        ]),
      );
      expect(lines).toHaveLength(3);
      await expect(entryStatus(billable.id)).resolves.toBe('INVOICED');
      await expect(entryStatus(unbillable.id)).resolves.toBe('NO');
      await expect(entryStatus(alreadyBilled.id)).resolves.toBe('INVOICED');
      await expect(entryStatus(someoneElses.id)).resolves.toBe('NO');
    });

    it('falls back to the legacy unitPrice as hourly rate and labels untitled time', async () => {
      const project = await seedProject(db.prisma8, owner, {
        unitPrice: toNumeric(30),
      });
      await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 7200,
      });
      const inv = await repo.generate(owner, 'INV-L', {
        projectId: project.id,
      });
      expect(inv.items).toEqual([
        expect.objectContaining({
          description: 'Time tracked',
          quantity: 2,
          unitPrice: 30,
          total: 60,
        }),
      ]);
      expect(inv.currency).toBe('EUR');
    });

    it("refuses someone else's project and creates nothing", async () => {
      const theirs = await seedProject(db.prisma8, stranger, {
        fixedFee: toNumeric(500),
      });
      await expect(
        repo.generate(owner, 'INV-X', { projectId: theirs.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.findAll(owner)).resolves.toMatchObject({ total: 0 });
    });

    it('counts a zero fee, rate or word count as nothing to invoice', async () => {
      const zeroFee = await seedProject(db.prisma8, owner, {
        fixedFee: toNumeric(0),
      });
      const noWords = await seedProject(db.prisma8, owner, {
        perWordRate: toNumeric(0.1),
        wordCount: 0,
      });
      const zeroRate = await seedProject(db.prisma8, owner, {
        perWordRate: toNumeric(0),
        wordCount: 500,
      });
      await expect(
        repo.generate(owner, 'INV-Z1', { projectId: zeroFee.id }),
      ).rejects.toThrow(/Nothing to invoice/);
      await expect(
        repo.generate(owner, 'INV-Z2', { projectId: noWords.id }),
      ).rejects.toThrow(/Nothing to invoice/);
      await expect(
        repo.generate(owner, 'INV-Z3', { projectId: zeroRate.id }),
      ).rejects.toThrow(/Nothing to invoice/);
    });

    it('refuses a project with no rates, even with tracked time', async () => {
      const project = await seedProject(db.prisma8, owner);
      await seedTimeEntry(db.prisma8, owner, {
        projectId: project.id,
        durationSeconds: 3600,
      });
      await expect(
        repo.generate(owner, 'INV-E', { projectId: project.id }),
      ).rejects.toThrow(/Nothing to invoice/);
    });
  });

  describe("references to other users' records", () => {
    let theirClient: number;
    let theirProject: number;
    const invoicesOf = (userId: number) =>
      db.prisma8.orm.public.Invoice.where({ userId }).all();

    beforeEach(async () => {
      theirClient = (await seedClient(db.prisma8, stranger)).id;
      theirProject = (await seedProject(db.prisma8, stranger)).id;
    });

    it("create and generate refuse another user's client", async () => {
      await expect(
        repo.create(owner, 'INV-X', { clientId: theirClient }),
      ).rejects.toBeInstanceOf(NotFoundException);
      const own = await seedProject(db.prisma8, owner);
      await expect(
        repo.generate(owner, 'INV-G', {
          projectId: own.id,
          clientId: theirClient,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(invoicesOf(owner)).resolves.toEqual([]);
    });

    it("update refuses another user's client and leaves the invoice as it was", async () => {
      const inv = await repo.create(owner, 'INV-1', {});
      const before = await db.prisma8.orm.public.Invoice.first({ id: inv.id });
      await expect(
        repo.update(inv.id, owner, { id: inv.id, clientId: theirClient }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        db.prisma8.orm.public.Invoice.first({ id: inv.id }),
      ).resolves.toEqual(before);
    });

    it("addItem refuses another user's project and adds nothing", async () => {
      const inv = await repo.create(owner, 'INV-1', {});
      await expect(
        repo.addItem(
          {
            invoiceId: inv.id,
            projectId: theirProject,
            quantity: 1,
            unitPrice: 1,
          },
          owner,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        db.prisma8.orm.public.InvoiceItem.where({ invoiceId: inv.id }).all(),
      ).resolves.toEqual([]);
    });
  });
});
