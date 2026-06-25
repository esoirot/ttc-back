import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { AdminRepository } from './repositories/admin.repository';
import { AuditService } from '../audit/audit.service';
import { ProjectStatus } from '../projects/entities/project.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';

describe('AdminService', () => {
  let service: AdminService;
  let repo: {
    getStats: jest.Mock;
    findClients: jest.Mock;
    findProjects: jest.Mock;
    findInvoices: jest.Mock;
    findTimeEntries: jest.Mock;
    findRates: jest.Mock;
    createClient: jest.Mock;
    updateClient: jest.Mock;
    deleteClient: jest.Mock;
    createProject: jest.Mock;
    updateProject: jest.Mock;
    deleteProject: jest.Mock;
    updateInvoice: jest.Mock;
    deleteInvoice: jest.Mock;
    deleteTimeEntry: jest.Mock;
    createRate: jest.Mock;
    updateRate: jest.Mock;
    deleteRate: jest.Mock;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      getStats: jest.fn().mockResolvedValue({ userCount: 1 }),
      findClients: jest.fn().mockResolvedValue({ edges: [] }),
      findProjects: jest.fn().mockResolvedValue({ edges: [] }),
      findInvoices: jest.fn().mockResolvedValue({ edges: [] }),
      findTimeEntries: jest.fn().mockResolvedValue({ edges: [] }),
      findRates: jest.fn().mockResolvedValue([]),
      createClient: jest.fn().mockResolvedValue({ id: 1, name: 'Corp' }),
      updateClient: jest.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
      deleteClient: jest.fn().mockResolvedValue({ deleted: true }),
      createProject: jest.fn().mockResolvedValue({ id: 1, title: 'Proj' }),
      updateProject: jest.fn().mockResolvedValue({ id: 1, title: 'Updated' }),
      deleteProject: jest.fn().mockResolvedValue({ deleted: true }),
      updateInvoice: jest.fn().mockResolvedValue({ id: 1, status: 'PAID' }),
      deleteInvoice: jest.fn().mockResolvedValue({ deleted: true }),
      deleteTimeEntry: jest.fn().mockResolvedValue({ deleted: true }),
      createRate: jest.fn().mockResolvedValue({ id: 1, name: 'Rate' }),
      updateRate: jest.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
      deleteRate: jest.fn().mockResolvedValue({ deleted: true }),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getStats — delegates to repo', async () => {
    const result = await service.getStats();
    expect(repo.getStats).toHaveBeenCalled();
    expect(result).toEqual({ userCount: 1 });
  });

  it('findClients — delegates with pagination and search', async () => {
    await service.findClients({ limit: 10 }, 'ACME');
    expect(repo.findClients).toHaveBeenCalledWith({ limit: 10 }, 'ACME');
  });

  it('findProjects — delegates with filters', async () => {
    await service.findProjects(undefined, 'Q1', ProjectStatus.ACTIVE);
    expect(repo.findProjects).toHaveBeenCalledWith(
      undefined,
      'Q1',
      ProjectStatus.ACTIVE,
    );
  });

  it('findInvoices — delegates with filters', async () => {
    await service.findInvoices(undefined, undefined, InvoiceStatus.DRAFT);
    expect(repo.findInvoices).toHaveBeenCalledWith(
      undefined,
      undefined,
      InvoiceStatus.DRAFT,
    );
  });

  it('findTimeEntries — delegates with userId', async () => {
    await service.findTimeEntries({ limit: 5 }, 3);
    expect(repo.findTimeEntries).toHaveBeenCalledWith({ limit: 5 }, 3);
  });

  it('findRates — delegates with type', async () => {
    await service.findRates('PER_WORD');
    expect(repo.findRates).toHaveBeenCalledWith('PER_WORD');
  });

  describe('createClient', () => {
    it('creates and logs ADMIN_CLIENT_CREATE', async () => {
      const result = await service.createClient(99, {
        name: 'Corp',
        userId: 5,
      });
      expect(repo.createClient).toHaveBeenCalledWith({
        name: 'Corp',
        userId: 5,
      });
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_CLIENT_CREATE',
        'client',
        { clientId: 1, name: 'Corp' },
      );
      expect(result.id).toBe(1);
    });
  });

  describe('updateClient', () => {
    it('updates and logs ADMIN_CLIENT_UPDATE', async () => {
      await service.updateClient(99, 1, { id: 1, name: 'New' });
      expect(repo.updateClient).toHaveBeenCalledWith(1, { id: 1, name: 'New' });
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_CLIENT_UPDATE',
        'client',
        { clientId: 1 },
      );
    });
  });

  describe('deleteClient', () => {
    it('deletes and logs ADMIN_CLIENT_DELETE', async () => {
      await service.deleteClient(99, 1);
      expect(repo.deleteClient).toHaveBeenCalledWith(1);
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_CLIENT_DELETE',
        'client',
        { clientId: 1 },
      );
    });
  });

  describe('createProject', () => {
    it('creates and logs ADMIN_PROJECT_CREATE', async () => {
      const result = await service.createProject(99, {
        userId: 5,
        title: 'Proj',
      });
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_PROJECT_CREATE',
        'project',
        { projectId: 1, title: 'Proj' },
      );
      expect(result.id).toBe(1);
    });
  });

  describe('updateProject', () => {
    it('updates and logs ADMIN_PROJECT_UPDATE', async () => {
      await service.updateProject(99, 1, { id: 1, title: 'New' });
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_PROJECT_UPDATE',
        'project',
        { projectId: 1 },
      );
    });
  });

  describe('deleteProject', () => {
    it('deletes and logs ADMIN_PROJECT_DELETE', async () => {
      await service.deleteProject(99, 5);
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_PROJECT_DELETE',
        'project',
        { projectId: 5 },
      );
    });
  });

  describe('updateInvoice', () => {
    it('updates and logs ADMIN_INVOICE_UPDATE', async () => {
      const result = await service.updateInvoice(99, 1, {
        id: 1,
        status: InvoiceStatus.PAID,
      });
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_INVOICE_UPDATE',
        'invoice',
        { invoiceId: 1 },
      );
      expect(result.status).toBe('PAID');
    });
  });

  describe('deleteInvoice', () => {
    it('deletes and logs ADMIN_INVOICE_DELETE', async () => {
      await service.deleteInvoice(99, 3);
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_INVOICE_DELETE',
        'invoice',
        { invoiceId: 3 },
      );
    });
  });

  describe('deleteTimeEntry', () => {
    it('deletes and logs ADMIN_TIME_ENTRY_DELETE', async () => {
      await service.deleteTimeEntry(99, 7);
      expect(audit.log).toHaveBeenCalledWith(
        99,
        'ADMIN_TIME_ENTRY_DELETE',
        'timeEntry',
        { entryId: 7 },
      );
    });
  });

  describe('createRate', () => {
    it('creates and logs ADMIN_RATE_CREATE', async () => {
      const result = await service.createRate(99, {
        userId: 5,
        activityId: 1,
        type: 'HOURLY',
        name: 'Rate',
        amount: 50,
        currency: 'EUR',
      });
      expect(audit.log).toHaveBeenCalledWith(99, 'ADMIN_RATE_CREATE', 'rate', {
        rateId: 1,
        name: 'Rate',
      });
      expect(result.id).toBe(1);
    });
  });

  describe('updateRate', () => {
    it('updates and logs ADMIN_RATE_UPDATE', async () => {
      await service.updateRate(99, 2, { id: 2, name: 'New' });
      expect(audit.log).toHaveBeenCalledWith(99, 'ADMIN_RATE_UPDATE', 'rate', {
        rateId: 2,
      });
    });
  });

  describe('deleteRate', () => {
    it('deletes and logs ADMIN_RATE_DELETE', async () => {
      await service.deleteRate(99, 4);
      expect(audit.log).toHaveBeenCalledWith(99, 'ADMIN_RATE_DELETE', 'rate', {
        rateId: 4,
      });
    });
  });
});
