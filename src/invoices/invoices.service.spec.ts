import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { InvoiceRepository } from './repositories/invoice.repository';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
import { UsersService } from '../users/users.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { mockInvoice } from '../__test-helpers__/mock-factories';

const makePage = () => ({
  getSize: jest.fn().mockReturnValue({ height: 842, width: 595 }),
  drawText: jest.fn(),
  drawLine: jest.fn(),
  drawImage: jest.fn(),
});

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn().mockResolvedValue({
      embedFont: jest.fn().mockResolvedValue({}),
      addPage: jest.fn().mockImplementation(makePage),
      save: jest.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
      embedPng: jest.fn().mockResolvedValue({ width: 100, height: 50 }),
      embedJpg: jest.fn().mockResolvedValue({ width: 100, height: 50 }),
    }),
  },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
  rgb: jest.fn().mockReturnValue({}),
}));

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: {
    findById: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
    generate: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    nextNumber: jest.Mock;
    addItem: jest.Mock;
    updateItem: jest.Mock;
    removeItem: jest.Mock;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      generate: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      nextNumber: jest.fn().mockResolvedValue('INV-001'),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: InvoiceRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: ClientsService, useValue: { findOne: jest.fn() } },
        { provide: UsersService, useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('calls nextNumber + create, logs INVOICE_CREATE', async () => {
      const invoice = mockInvoice({ id: 5, number: 'INV-001' });
      repo.nextNumber.mockResolvedValue('INV-001');
      repo.create.mockResolvedValue(invoice);

      const result = await service.create(1, { currency: 'EUR' });

      expect(repo.nextNumber).toHaveBeenCalledWith(1);
      expect(repo.create).toHaveBeenCalledWith(1, 'INV-001', {
        currency: 'EUR',
      });
      expect(audit.log).toHaveBeenCalledWith(1, 'INVOICE_CREATE', 'invoice', {
        invoiceId: 5,
        number: 'INV-001',
      });
      expect(result).toEqual(invoice);
    });
  });

  describe('generate', () => {
    it('calls nextNumber + generate, logs INVOICE_CREATE', async () => {
      const invoice = mockInvoice({ id: 6, number: 'INV-002' });
      repo.nextNumber.mockResolvedValue('INV-002');
      repo.generate.mockResolvedValue(invoice);

      const result = await service.generate(1, { projectId: 7 });

      expect(repo.nextNumber).toHaveBeenCalledWith(1);
      expect(repo.generate).toHaveBeenCalledWith(1, 'INV-002', {
        projectId: 7,
      });
      expect(audit.log).toHaveBeenCalledWith(1, 'INVOICE_CREATE', 'invoice', {
        invoiceId: 6,
        number: 'INV-002',
      });
      expect(result).toEqual(invoice);
    });
  });

  describe('update', () => {
    it('does not fetch current or log status change when status not in input', async () => {
      const invoice = mockInvoice();
      repo.update.mockResolvedValue(invoice);

      await service.update(1, 1, { id: 1, notes: 'Updated notes' });

      expect(repo.findById).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('fetches current and logs INVOICE_STATUS_CHANGE when status provided', async () => {
      const current = mockInvoice({ status: 'DRAFT', number: 'INV-001' });
      const updated = mockInvoice({ id: 1, status: 'SENT', number: 'INV-001' });
      repo.findById.mockResolvedValue(current);
      repo.update.mockResolvedValue(updated);

      await service.update(1, 1, { id: 1, status: InvoiceStatus.SENT });

      expect(repo.findById).toHaveBeenCalledWith(1, 1);
      expect(audit.log).toHaveBeenCalledWith(
        1,
        'INVOICE_STATUS_CHANGE',
        'invoice',
        {
          invoiceId: 1,
          number: 'INV-001',
          from: 'DRAFT',
          to: 'SENT',
        },
      );
    });

    it('returns updated invoice', async () => {
      const invoice = mockInvoice({ notes: 'new note' });
      repo.update.mockResolvedValue(invoice);

      const result = await service.update(1, 1, {
        id: 1,
        notes: 'new note',
      });
      expect(result).toEqual(invoice);
    });
  });

  describe('delete', () => {
    it('fetches invoice for number, deletes, and logs INVOICE_DELETE', async () => {
      const invoice = mockInvoice({ id: 1, number: 'INV-001' });
      repo.findById.mockResolvedValue(invoice);
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(1, 1);

      expect(repo.findById).toHaveBeenCalledWith(1, 1);
      expect(repo.delete).toHaveBeenCalledWith(1, 1);
      expect(audit.log).toHaveBeenCalledWith(1, 'INVOICE_DELETE', 'invoice', {
        invoiceId: 1,
        number: 'INV-001',
      });
      expect(result).toBe(true);
    });
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      const connection = { edges: [], pageInfo: { hasNextPage: false } };
      repo.findAll.mockResolvedValue(connection);

      const result = await service.findAll(1, 'DRAFT', { limit: 10 }, 2, 'INV');
      expect(repo.findAll).toHaveBeenCalledWith(
        1,
        'DRAFT',
        { limit: 10 },
        2,
        'INV',
      );
      expect(result).toEqual(connection);
    });
  });

  describe('findOne', () => {
    it('delegates to repository', async () => {
      const invoice = mockInvoice();
      repo.findById.mockResolvedValue(invoice);

      const result = await service.findOne(1, 1);
      expect(result).toEqual(invoice);
    });
  });

  describe('addItem', () => {
    it('delegates to repository', async () => {
      const item = {
        id: 1,
        invoiceId: 1,
        projectId: null,
        timeEntryId: null,
        description: 'Work',
        quantity: 1,
        unitPrice: 100,
        total: 100,
      };
      repo.addItem.mockResolvedValue(item);

      const result = await service.addItem({
        invoiceId: 1,
        description: 'Work',
        quantity: 1,
        unitPrice: 100,
      });
      expect(result).toEqual(item);
    });
  });

  describe('removeItem', () => {
    it('delegates to repository', async () => {
      repo.removeItem.mockResolvedValue(true);

      const result = await service.removeItem(1);
      expect(repo.removeItem).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('generatePdf', () => {
    let clientsService: { findOne: jest.Mock };
    let usersService: { findOne: jest.Mock };

    beforeEach(() => {
      clientsService = { findOne: jest.fn() };
      usersService = { findOne: jest.fn() };
    });

    const buildService = async () => {
      const m = await Test.createTestingModule({
        providers: [
          InvoicesService,
          { provide: InvoiceRepository, useValue: repo },
          { provide: AuditService, useValue: audit },
          { provide: ClientsService, useValue: clientsService },
          { provide: UsersService, useValue: usersService },
        ],
      }).compile();
      return m.get(InvoicesService);
    };

    it('returns Uint8Array for invoice without client or logo', async () => {
      const invoice = mockInvoice({ clientId: null, items: [], notes: null });
      repo.findById.mockResolvedValue(invoice);
      usersService.findOne.mockResolvedValue({ id: 1, logoUrl: null });

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('renders client block when clientId present', async () => {
      const invoice = mockInvoice({
        clientId: 5,
        items: [],
        notes: null,
        issuedAt: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
      });
      const client = {
        id: 5,
        name: 'Acme Corp',
        company: 'ACME',
        email: 'acme@x.com',
        phone: '555',
        address: '123 Main\nSuite 4',
      };
      repo.findById.mockResolvedValue(invoice);
      clientsService.findOne.mockResolvedValue(client);
      usersService.findOne.mockResolvedValue({ id: 1, logoUrl: null });

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(clientsService.findOne).toHaveBeenCalledWith(5, 1);
    });

    it('silently skips client when fetch throws', async () => {
      const invoice = mockInvoice({ clientId: 99, items: [], notes: null });
      repo.findById.mockResolvedValue(invoice);
      clientsService.findOne.mockRejectedValue(new Error('Not found'));
      usersService.findOne.mockResolvedValue({ id: 1, logoUrl: null });

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('renders invoice items in table', async () => {
      const invoice = mockInvoice({
        clientId: null,
        items: [
          {
            id: 1,
            invoiceId: 1,
            projectId: null,
            timeEntryId: null,
            description: 'Translation work',
            quantity: 5,
            unitPrice: 0.1,
            total: 0.5,
          },
          {
            id: 2,
            invoiceId: 1,
            projectId: null,
            timeEntryId: null,
            description: 'Revision',
            quantity: 1,
            unitPrice: 20,
            total: 20,
          },
        ],
        notes: null,
      });
      repo.findById.mockResolvedValue(invoice);
      usersService.findOne.mockResolvedValue({ id: 1, logoUrl: null });

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('renders notes section', async () => {
      const invoice = mockInvoice({
        clientId: null,
        items: [],
        notes: 'Payment due in 30 days.\nBank transfer only.',
      });
      repo.findById.mockResolvedValue(invoice);
      usersService.findOne.mockResolvedValue({ id: 1, logoUrl: null });

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('loads and embeds PNG logo', async () => {
      const invoice = mockInvoice({ clientId: null, items: [], notes: null });
      repo.findById.mockResolvedValue(invoice);
      usersService.findOne.mockResolvedValue({
        id: 1,
        logoUrl: 'https://example.com/logo.png',
      });

      const pngChunk = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const mockBody = (function* () {
        yield pngChunk;
      })();
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        body: mockBody,
        headers: {
          get: (k: string) => (k === 'content-type' ? 'image/png' : null),
        },
      } as unknown as Response);

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
      jest.restoreAllMocks();
    });

    it('silently skips logo when fetch fails', async () => {
      const invoice = mockInvoice({ clientId: null, items: [], notes: null });
      repo.findById.mockResolvedValue(invoice);
      usersService.findOne.mockResolvedValue({
        id: 1,
        logoUrl: 'https://example.com/logo.png',
      });

      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'));

      const svc = await buildService();
      const result = await svc.generatePdf(1, 1);

      expect(result).toBeInstanceOf(Uint8Array);
      jest.restoreAllMocks();
    });

    it('skips logo for private/blocked URLs (SSRF guard)', async () => {
      const invoice = mockInvoice({ clientId: null, items: [], notes: null });
      repo.findById.mockResolvedValue(invoice);
      usersService.findOne.mockResolvedValue({
        id: 1,
        logoUrl: 'http://192.168.1.1/logo.png',
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      const svc = await buildService();
      await svc.generatePdf(1, 1);

      // isAllowedLogoUrl blocks http:// and private IPs — fetch must not be called
      expect(fetchSpy).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });
});
