import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaInvoiceRepository } from './prisma-invoice.repository';
import type { PrismaService } from '../../prisma.service';

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    invoiceId: 1,
    projectId: null,
    timeEntryId: null,
    description: '',
    quantity: { toNumber: () => 1 },
    unitPrice: { toNumber: () => 10 },
    total: { toNumber: () => 10 },
    ...overrides,
  };
}

function makeInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 1,
    clientId: null,
    number: 'INV-001',
    status: 'DRAFT',
    currency: 'EUR',
    issuedAt: null,
    dueDate: null,
    paidAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  };
}

describe('PrismaInvoiceRepository', () => {
  let repo: PrismaInvoiceRepository;
  let prisma: {
    project: { findUnique: jest.Mock };
    timeEntry: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    invoice: { create: jest.Mock; findFirst: jest.Mock };
    invoiceItem: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      project: { findUnique: jest.fn() },
      timeEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      invoice: { create: jest.fn(), findFirst: jest.fn() },
      invoiceItem: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    repo = new PrismaInvoiceRepository(prisma as unknown as PrismaService);
  });

  describe('generate', () => {
    it('only selects billable entries with invoicingStatus NO for hourly line items', async () => {
      prisma.project.findUnique.mockResolvedValue({
        fixedFee: null,
        hourlyRate: { toNumber: () => 50 },
        perWordRate: null,
        wordCount: 0,
        unitPrice: null,
      });
      prisma.invoice.create.mockResolvedValue(makeInvoiceRow());

      await repo.generate(1, 'INV-001', { projectId: 5 });

      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          projectId: 5,
          billable: true,
          invoicingStatus: 'NO',
        },
      });
    });

    it('marks every consumed time entry INVOICED in the same transaction as invoice creation', async () => {
      prisma.project.findUnique.mockResolvedValue({
        fixedFee: null,
        hourlyRate: { toNumber: () => 50 },
        perWordRate: null,
        wordCount: 0,
        unitPrice: null,
      });
      prisma.timeEntry.findMany.mockResolvedValue([
        { id: 10, description: 'A', durationSeconds: 3600 },
        { id: 11, description: 'B', durationSeconds: 1800 },
      ]);
      prisma.invoice.create.mockResolvedValue(makeInvoiceRow());

      await repo.generate(1, 'INV-001', { projectId: 5 });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.timeEntry.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] } },
        data: { invoicingStatus: 'INVOICED' },
      });
    });

    it('does not touch timeEntry when no entries are consumed', async () => {
      prisma.project.findUnique.mockResolvedValue({
        fixedFee: { toNumber: () => 300 },
        hourlyRate: null,
        perWordRate: null,
        wordCount: 0,
        unitPrice: null,
      });
      prisma.invoice.create.mockResolvedValue(makeInvoiceRow());

      await repo.generate(1, 'INV-001', { projectId: 5 });

      expect(prisma.timeEntry.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('rejects when the referenced time entry does not exist for this user', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 1, userId: 1 });
      prisma.timeEntry.findFirst.mockResolvedValue(null);

      await expect(
        repo.addItem(
          { invoiceId: 1, quantity: 1, unitPrice: 10, timeEntryId: 99 },
          1,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.invoiceItem.create).not.toHaveBeenCalled();
    });

    it('scopes the time entry lookup to the calling user', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 1, userId: 1 });
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 9,
        billable: true,
        invoicingStatus: 'NO',
      });
      prisma.invoiceItem.create.mockResolvedValue(makeItemRow());

      await repo.addItem(
        { invoiceId: 1, quantity: 1, unitPrice: 10, timeEntryId: 9 },
        1,
      );

      expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 9, userId: 1 },
      });
    });

    it('rejects when the referenced time entry is not billable', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 1, userId: 1 });
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 9,
        billable: false,
        invoicingStatus: 'NO',
      });

      await expect(
        repo.addItem(
          { invoiceId: 1, quantity: 1, unitPrice: 10, timeEntryId: 9 },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.invoiceItem.create).not.toHaveBeenCalled();
    });

    it('rejects when the referenced time entry is already INVOICED', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 1, userId: 1 });
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 9,
        billable: true,
        invoicingStatus: 'INVOICED',
      });

      await expect(
        repo.addItem(
          { invoiceId: 1, quantity: 1, unitPrice: 10, timeEntryId: 9 },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.invoiceItem.create).not.toHaveBeenCalled();
    });

    it('creates the item and flips the entry to INVOICED in the same transaction', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 1, userId: 1 });
      prisma.timeEntry.findFirst.mockResolvedValue({
        id: 9,
        billable: true,
        invoicingStatus: 'NO',
      });
      prisma.invoiceItem.create.mockResolvedValue(
        makeItemRow({ timeEntryId: 9 }),
      );

      await repo.addItem(
        { invoiceId: 1, quantity: 1, unitPrice: 10, timeEntryId: 9 },
        1,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { invoicingStatus: 'INVOICED' },
      });
      expect(prisma.invoiceItem.create).toHaveBeenCalled();
    });

    it('still creates an item when no timeEntryId is supplied, without touching timeEntry', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 1, userId: 1 });
      prisma.invoiceItem.create.mockResolvedValue(makeItemRow());

      await repo.addItem({ invoiceId: 1, quantity: 1, unitPrice: 10 }, 1);

      expect(prisma.timeEntry.findFirst).not.toHaveBeenCalled();
      expect(prisma.timeEntry.update).not.toHaveBeenCalled();
      expect(prisma.invoiceItem.create).toHaveBeenCalled();
    });
  });
});
