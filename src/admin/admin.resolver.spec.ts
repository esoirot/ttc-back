import { Test, TestingModule } from '@nestjs/testing';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { ProjectStatus } from '../projects/entities/project.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';

describe('AdminResolver', () => {
  let resolver: AdminResolver;
  let service: {
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

  const adminUser = { id: 99, role: 'ADMIN' };

  beforeEach(async () => {
    service = {
      getStats: jest.fn(),
      findClients: jest.fn(),
      findProjects: jest.fn(),
      findInvoices: jest.fn(),
      findTimeEntries: jest.fn(),
      findRates: jest.fn(),
      createClient: jest.fn(),
      updateClient: jest.fn(),
      deleteClient: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      deleteTimeEntry: jest.fn(),
      createRate: jest.fn(),
      updateRate: jest.fn(),
      deleteRate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminResolver, { provide: AdminService, useValue: service }],
    }).compile();

    resolver = module.get<AdminResolver>(AdminResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('getStats — delegates to service', async () => {
    const stats = { userCount: 5, projectCount: 10, invoiceCount: 3 };
    service.getStats.mockResolvedValue(stats);

    const result = await resolver.getStats();
    expect(service.getStats).toHaveBeenCalled();
    expect(result).toEqual(stats);
  });

  it('findClients — delegates with pagination and search', async () => {
    service.findClients.mockResolvedValue({ edges: [] });

    await resolver.findClients({ limit: 10 }, 'ACME');
    expect(service.findClients).toHaveBeenCalledWith({ limit: 10 }, 'ACME');
  });

  it('findProjects — delegates with filters', async () => {
    service.findProjects.mockResolvedValue({ edges: [] });

    await resolver.findProjects(undefined, undefined, ProjectStatus.ACTIVE);
    expect(service.findProjects).toHaveBeenCalledWith(
      undefined,
      undefined,
      ProjectStatus.ACTIVE,
    );
  });

  it('findInvoices — delegates with filters', async () => {
    service.findInvoices.mockResolvedValue({ edges: [] });

    await resolver.findInvoices(undefined, undefined, InvoiceStatus.DRAFT);
    expect(service.findInvoices).toHaveBeenCalledWith(
      undefined,
      undefined,
      InvoiceStatus.DRAFT,
    );
  });

  it('findTimeEntries — delegates with userId', async () => {
    service.findTimeEntries.mockResolvedValue({ edges: [] });

    await resolver.findTimeEntries(undefined, 5);
    expect(service.findTimeEntries).toHaveBeenCalledWith(undefined, 5);
  });

  it('findRates — delegates with type', async () => {
    service.findRates.mockResolvedValue({ edges: [] });

    await resolver.findRates('PER_WORD');
    expect(service.findRates).toHaveBeenCalledWith('PER_WORD');
  });

  it('adminCreateClient — delegates with admin user id', async () => {
    const client = { id: 1, name: 'Corp' };
    service.createClient.mockResolvedValue(client);

    const result = await resolver.adminCreateClient(
      { userId: 5, name: 'Corp' },
      adminUser,
    );
    expect(service.createClient).toHaveBeenCalledWith(99, {
      userId: 5,
      name: 'Corp',
    });
    expect(result).toEqual(client);
  });

  it('adminUpdateClient — delegates with id from input', async () => {
    const client = { id: 3, name: 'Updated' };
    service.updateClient.mockResolvedValue(client);

    const result = await resolver.adminUpdateClient(
      { id: 3, name: 'Updated' },
      adminUser,
    );
    expect(service.updateClient).toHaveBeenCalledWith(99, 3, {
      id: 3,
      name: 'Updated',
    });
    expect(result).toEqual(client);
  });

  it('adminDeleteClient — delegates to service', async () => {
    const res = { deleted: true };
    service.deleteClient.mockResolvedValue(res);

    const result = await resolver.adminDeleteClient(3, adminUser);
    expect(service.deleteClient).toHaveBeenCalledWith(99, 3);
    expect(result).toEqual(res);
  });

  it('adminCreateProject — delegates with admin user id', async () => {
    const project = { id: 1, title: 'New Project' };
    service.createProject.mockResolvedValue(project);

    const result = await resolver.adminCreateProject(
      { userId: 5, title: 'New Project' },
      adminUser,
    );
    expect(service.createProject).toHaveBeenCalledWith(99, {
      userId: 5,
      title: 'New Project',
    });
    expect(result).toEqual(project);
  });

  it('adminDeleteProject — delegates to service', async () => {
    const res = { deleted: true };
    service.deleteProject.mockResolvedValue(res);

    const result = await resolver.adminDeleteProject(5, adminUser);
    expect(service.deleteProject).toHaveBeenCalledWith(99, 5);
    expect(result).toEqual(res);
  });

  it('adminUpdateInvoice — delegates to service', async () => {
    const invoice = { id: 1, status: 'PAID' };
    service.updateInvoice.mockResolvedValue(invoice);

    const result = await resolver.adminUpdateInvoice(
      { id: 1, status: InvoiceStatus.PAID },
      adminUser,
    );
    expect(service.updateInvoice).toHaveBeenCalledWith(99, 1, {
      id: 1,
      status: InvoiceStatus.PAID,
    });
    expect(result).toEqual(invoice);
  });

  it('adminDeleteTimeEntry — delegates to service', async () => {
    const res = { deleted: true };
    service.deleteTimeEntry.mockResolvedValue(res);

    const result = await resolver.adminDeleteTimeEntry(7, adminUser);
    expect(service.deleteTimeEntry).toHaveBeenCalledWith(99, 7);
    expect(result).toEqual(res);
  });

  it('adminCreateRate — delegates to service', async () => {
    const rate = { id: 1, name: 'Rate' };
    service.createRate.mockResolvedValue(rate);

    const rateInput = {
      userId: 5,
      activityId: 1,
      type: 'HOURLY' as const,
      name: 'Rate',
      amount: 50,
      currency: 'EUR',
    };

    const result = await resolver.adminCreateRate(rateInput, adminUser);
    expect(service.createRate).toHaveBeenCalledWith(99, rateInput);
    expect(result).toEqual(rate);
  });

  it('adminDeleteRate — delegates to service', async () => {
    const res = { deleted: true };
    service.deleteRate.mockResolvedValue(res);

    const result = await resolver.adminDeleteRate(2, adminUser);
    expect(service.deleteRate).toHaveBeenCalledWith(99, 2);
    expect(result).toEqual(res);
  });

  it('adminUpdateProject — delegates with id from input', async () => {
    const project = { id: 2, title: 'Updated Project' };
    service.updateProject.mockResolvedValue(project);

    const result = await resolver.adminUpdateProject(
      { id: 2, title: 'Updated Project' },
      adminUser,
    );
    expect(service.updateProject).toHaveBeenCalledWith(99, 2, {
      id: 2,
      title: 'Updated Project',
    });
    expect(result).toEqual(project);
  });

  it('adminDeleteInvoice — delegates to service', async () => {
    const res = { deleted: true };
    service.deleteInvoice.mockResolvedValue(res);

    const result = await resolver.adminDeleteInvoice(8, adminUser);
    expect(service.deleteInvoice).toHaveBeenCalledWith(99, 8);
    expect(result).toEqual(res);
  });

  it('adminUpdateRate — delegates with id from input', async () => {
    const rate = { id: 3, name: 'Updated Rate' };
    service.updateRate.mockResolvedValue(rate);

    const result = await resolver.adminUpdateRate(
      { id: 3, name: 'Updated Rate' },
      adminUser,
    );
    expect(service.updateRate).toHaveBeenCalledWith(99, 3, {
      id: 3,
      name: 'Updated Rate',
    });
    expect(result).toEqual(rate);
  });
});
