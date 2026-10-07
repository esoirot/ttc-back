import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RateType } from '../../generated/prisma/client';
import { InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { toNumeric } from '../../prisma8/numeric';
import { toDb } from '../../prisma8/timestamp';
import {
  seedClient,
  seedOccupation,
  seedProject,
  seedTimeEntry,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { ProjectStatus } from '../../projects/entities/project.entity';
import { AdminRepository } from './admin.repository';
import { PrismaAdminRepository } from './prisma-admin.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();
const MISSING = 999999;

describe.each([
  ['prisma7', (): AdminRepository => new PrismaAdminRepository(db.prisma7)],
])('AdminRepository (%s)', (_impl, make) => {
  let repo: AdminRepository;
  let alice: { id: number; email: string };
  let bob: { id: number; email: string };

  const invoice = (
    userId: number,
    number: string,
    data: { clientId?: number; status?: 'DRAFT' | 'SENT'; notes?: string } = {},
  ) =>
    db.prisma8.orm.public.Invoice.create({
      userId,
      number,
      updatedAt: toDb(new Date()),
      ...data,
    });
  const ids = (page: { items: { id: number }[] }) =>
    page.items.map((i) => i.id);

  beforeEach(async () => {
    repo = make();
    alice = await seedUser(db.prisma8, { name: 'Alice' });
    bob = await seedUser(db.prisma8);
  });

  describe('getStats', () => {
    it('counts and sums across every user', async () => {
      await seedClient(db.prisma8, alice.id);
      await seedProject(db.prisma8, bob.id);
      const inv = await invoice(alice.id, 'I-1');
      await db.prisma8.orm.public.InvoiceItem.create({
        invoiceId: inv.id,
        description: 'x',
        quantity: toNumeric(1),
        unitPrice: toNumeric(99.5),
        total: toNumeric(99.5),
      });
      await seedTimeEntry(db.prisma8, alice.id, { durationSeconds: 60 });
      await seedTimeEntry(db.prisma8, bob.id, { durationSeconds: 40 });

      await expect(repo.getStats()).resolves.toEqual({
        totalUsers: 2,
        totalClients: 1,
        totalProjects: 1,
        totalInvoices: 1,
        totalRevenue: 99.5,
        totalTimeSeconds: 100,
      });
    });

    it('is zero on an empty database', async () => {
      await expect(repo.getStats()).resolves.toMatchObject({
        totalRevenue: 0,
        totalTimeSeconds: 0,
      });
    });
  });

  describe('lists', () => {
    it("pages every user's clients by id with their owner and contacts, searchable by name", async () => {
      const a = await seedClient(db.prisma8, alice.id, { name: 'Acme' });
      const b = await seedClient(db.prisma8, bob.id, { name: 'acme labs' });
      await seedClient(db.prisma8, bob.id, { name: 'Other' });
      await db.prisma8.orm.public.CompanyContact.create({
        clientId: a.id,
        firstName: 'Ann',
        updatedAt: toDb(new Date()),
      });

      const page = await repo.findClients({ limit: 1 }, 'ACME');
      expect(page).toMatchObject({ total: 2, nextCursor: a.id });
      expect(page.items[0]).toMatchObject({
        id: a.id,
        userId: alice.id,
        name: 'Acme',
        owner: { id: alice.id, email: alice.email, name: 'Alice' },
        contacts: [
          {
            id: anyNumber,
            clientId: a.id,
            firstName: 'Ann',
            lastName: null,
            email: null,
            phone: null,
          },
        ],
      });
      await expect(
        repo.findClients({ cursor: a.id }, 'acme').then(ids),
      ).resolves.toEqual([b.id]);
    });

    it('filters projects by title and status, owner null for an ownerless project', async () => {
      const p = await seedProject(db.prisma8, alice.id, {
        title: 'Game',
        status: 'ACTIVE',
        unitPrice: toNumeric(12.5),
      });
      await seedProject(db.prisma8, bob.id, { title: 'game 2' });
      const orphan = await db.prisma8.orm.public.Project.create({
        title: 'Orphan',
        updatedAt: toDb(new Date()),
      });

      await expect(
        repo.findProjects(undefined, 'GAME', ProjectStatus.ACTIVE),
      ).resolves.toMatchObject({
        total: 1,
        items: [
          {
            id: p.id,
            unitPrice: 12.5,
            status: 'ACTIVE',
            owner: { id: alice.id },
          },
        ],
      });
      await expect(
        repo.findProjects(undefined, 'orphan'),
      ).resolves.toMatchObject({
        items: [{ id: orphan.id, owner: null, unitPrice: null }],
      });
    });

    it('filters invoices by number/notes search and status, with items', async () => {
      const a = await invoice(alice.id, 'INV-001', {
        notes: 'Game',
        status: 'SENT',
      });
      await invoice(bob.id, 'INV-002');
      await db.prisma8.orm.public.InvoiceItem.create({
        invoiceId: a.id,
        description: 'x',
        quantity: toNumeric(2),
        unitPrice: toNumeric(10),
        total: toNumeric(20),
      });

      await expect(
        repo.findInvoices(undefined, 'game', InvoiceStatus.SENT),
      ).resolves.toMatchObject({
        total: 1,
        items: [
          {
            id: a.id,
            owner: { id: alice.id },
            items: [{ quantity: 2, unitPrice: 10, total: 20 }],
          },
        ],
      });
      await expect(
        repo.findInvoices(undefined, 'INV-00'),
      ).resolves.toMatchObject({ total: 2 });
    });

    it('pages time entries, optionally for one user', async () => {
      const e1 = await seedTimeEntry(db.prisma8, alice.id);
      const e2 = await seedTimeEntry(db.prisma8, bob.id);
      await expect(repo.findTimeEntries().then(ids)).resolves.toEqual([
        e1.id,
        e2.id,
      ]);
      await expect(
        repo.findTimeEntries(undefined, bob.id),
      ).resolves.toMatchObject({
        total: 1,
        items: [{ id: e2.id, owner: { id: bob.id } }],
      });
    });

    it('lists every rate, optionally by type, without paging', async () => {
      const occupation = await seedOccupation(db.prisma8, alice.id);
      const hourly = await repo.createRate({
        userId: alice.id,
        occupationId: occupation.id,
        type: RateType.HOURLY,
        name: 'H',
        amount: 50,
        currency: 'EUR',
      });
      await repo.createRate({
        userId: bob.id,
        occupationId: occupation.id,
        type: RateType.PER_WORD,
        name: 'W',
        amount: 0.1,
        currency: 'EUR',
      });

      await expect(repo.findRates()).resolves.toMatchObject({
        total: 2,
        nextCursor: null,
      });
      await expect(repo.findRates(RateType.HOURLY)).resolves.toMatchObject({
        total: 1,
        items: [{ id: hourly.id, owner: { id: alice.id } }],
      });
    });
  });

  describe('clients', () => {
    it('creates for any user, updates, and NotFound on unknown ids', async () => {
      const created = await repo.createClient({
        userId: bob.id,
        name: 'New',
        city: 'Paris',
      });
      expect(created).toMatchObject({
        userId: bob.id,
        name: 'New',
        city: 'Paris',
        contacts: [],
        owner: { id: bob.id },
      });
      await expect(
        repo.updateClient(created.id, { id: created.id, notes: 'n' }),
      ).resolves.toMatchObject({ name: 'New', notes: 'n' });
      await expect(
        repo.updateClient(MISSING, { id: MISSING, name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes, reporting and unlinking its projects and invoices', async () => {
      const client = await seedClient(db.prisma8, alice.id);
      const project = await seedProject(db.prisma8, alice.id, {
        clientId: client.id,
      });
      const inv = await invoice(alice.id, 'I-1', { clientId: client.id });

      await expect(repo.deleteClient(client.id)).resolves.toEqual({
        id: client.id,
        orphanedRecords: 2,
      });

      await expect(
        db.prisma8.orm.public.Project.first({ id: project.id }),
      ).resolves.toMatchObject({ clientId: null });
      await expect(
        db.prisma8.orm.public.Invoice.first({ id: inv.id }),
      ).resolves.toMatchObject({ clientId: null });
      await expect(repo.deleteClient(client.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('projects', () => {
    it('creates for any user, updates, and NotFound on unknown ids', async () => {
      const created = await repo.createProject({
        userId: alice.id,
        title: 'P',
        unitPrice: 20,
        wordCount: 100,
      });
      expect(created).toMatchObject({
        userId: alice.id,
        title: 'P',
        status: 'DRAFT',
        currency: 'EUR',
        unitPrice: 20,
        owner: { id: alice.id },
      });
      await expect(
        repo.updateProject(created.id, {
          id: created.id,
          status: ProjectStatus.ACTIVE,
          unitPrice: 25,
        }),
      ).resolves.toMatchObject({ status: 'ACTIVE', unitPrice: 25 });
      await expect(
        repo.updateProject(MISSING, { id: MISSING, title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes, reporting and unlinking its time entries and invoice items', async () => {
      const project = await seedProject(db.prisma8, alice.id);
      const entry = await seedTimeEntry(db.prisma8, alice.id, {
        projectId: project.id,
      });
      const inv = await invoice(alice.id, 'I-1');
      const item = await db.prisma8.orm.public.InvoiceItem.create({
        invoiceId: inv.id,
        projectId: project.id,
        description: 'x',
        quantity: toNumeric(1),
        unitPrice: toNumeric(1),
        total: toNumeric(1),
      });

      await expect(repo.deleteProject(project.id)).resolves.toEqual({
        id: project.id,
        orphanedRecords: 2,
      });

      await expect(
        db.prisma8.orm.public.TimeEntry.first({ id: entry.id }),
      ).resolves.toMatchObject({ projectId: null });
      await expect(
        db.prisma8.orm.public.InvoiceItem.first({ id: item.id }),
      ).resolves.toMatchObject({ projectId: null });
      await expect(repo.deleteProject(project.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('invoices', () => {
    it('updates any invoice without transition rules, NotFound on unknown ids', async () => {
      const inv = await invoice(alice.id, 'I-1');
      await expect(
        repo.updateInvoice(inv.id, {
          id: inv.id,
          status: InvoiceStatus.PAID,
          notes: 'admin',
        }),
      ).resolves.toMatchObject({
        status: 'PAID',
        notes: 'admin',
        paidAt: null,
        owner: { id: alice.id },
        items: [],
      });
      await expect(
        repo.updateInvoice(MISSING, { id: MISSING, notes: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes drafts only', async () => {
      const draft = await invoice(alice.id, 'I-1');
      const sent = await invoice(alice.id, 'I-2', { status: 'SENT' });
      await expect(repo.deleteInvoice(sent.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(repo.deleteInvoice(draft.id)).resolves.toEqual({
        id: draft.id,
      });
      await expect(repo.deleteInvoice(draft.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('time entries and rates', () => {
    it('deletes a time entry, NotFound on unknown ids', async () => {
      const entry = await seedTimeEntry(db.prisma8, bob.id);
      await expect(repo.deleteTimeEntry(entry.id)).resolves.toEqual({
        id: entry.id,
      });
      await expect(repo.deleteTimeEntry(entry.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates, updates and deletes a rate, NotFound on unknown ids', async () => {
      const occupation = await seedOccupation(db.prisma8, alice.id);
      const rate = await repo.createRate({
        userId: alice.id,
        occupationId: occupation.id,
        type: RateType.DAY,
        name: 'Day',
        amount: 400,
        currency: 'EUR',
        description: 'd',
      });
      expect(rate).toMatchObject({
        userId: alice.id,
        type: 'DAY',
        name: 'Day',
        amount: 400,
        currency: 'EUR',
        description: 'd',
        owner: { id: alice.id },
      });
      await expect(
        repo.updateRate(rate.id, { id: rate.id, amount: 450 }),
      ).resolves.toMatchObject({ amount: 450, name: 'Day' });
      await expect(
        repo.updateRate(MISSING, { id: MISSING, amount: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.deleteRate(rate.id)).resolves.toEqual({ id: rate.id });
      await expect(repo.deleteRate(rate.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
