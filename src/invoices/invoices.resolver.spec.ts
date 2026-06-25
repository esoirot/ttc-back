import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesResolver } from './invoices.resolver';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { mockInvoice } from '../__test-helpers__/mock-factories';

describe('InvoicesResolver', () => {
  let resolver: InvoicesResolver;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    generate: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    addItem: jest.Mock;
    updateItem: jest.Mock;
    removeItem: jest.Mock;
  };

  const user = { id: 1 };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      generate: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesResolver,
        { provide: InvoicesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<InvoicesResolver>(InvoicesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findAll — delegates with all filters', async () => {
    service.findAll.mockResolvedValue({ edges: [] });

    await resolver.findAll(user, InvoiceStatus.DRAFT, { limit: 5 }, 2, 'INV');
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      InvoiceStatus.DRAFT,
      { limit: 5 },
      2,
      'INV',
    );
  });

  it('findOne — delegates to service', async () => {
    const invoice = mockInvoice();
    service.findOne.mockResolvedValue(invoice);

    const result = await resolver.findOne(1, user);
    expect(service.findOne).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(invoice);
  });

  it('createInvoice — delegates to service', async () => {
    const invoice = mockInvoice();
    service.create.mockResolvedValue(invoice);

    const result = await resolver.createInvoice({ currency: 'EUR' }, user);
    expect(service.create).toHaveBeenCalledWith(1, { currency: 'EUR' });
    expect(result).toEqual(invoice);
  });

  it('generateInvoice — delegates to service', async () => {
    const invoice = mockInvoice();
    service.generate.mockResolvedValue(invoice);

    const result = await resolver.generateInvoice({ projectId: 5 }, user);
    expect(service.generate).toHaveBeenCalledWith(1, { projectId: 5 });
    expect(result).toEqual(invoice);
  });

  it('updateInvoice — delegates with id from input', async () => {
    const invoice = mockInvoice({ status: 'SENT' });
    service.update.mockResolvedValue(invoice);

    const result = await resolver.updateInvoice(
      { id: 1, status: InvoiceStatus.SENT },
      user,
    );
    expect(service.update).toHaveBeenCalledWith(1, 1, {
      id: 1,
      status: InvoiceStatus.SENT,
    });
    expect(result).toEqual(invoice);
  });

  it('deleteInvoice — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteInvoice(1, user);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });

  it('addInvoiceItem — delegates to service', async () => {
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
    service.addItem.mockResolvedValue(item);

    const result = await resolver.addInvoiceItem({
      invoiceId: 1,
      description: 'Work',
      quantity: 1,
      unitPrice: 100,
    });
    expect(service.addItem).toHaveBeenCalled();
    expect(result).toEqual(item);
  });

  it('updateInvoiceItem — delegates with id from input', async () => {
    const item = {
      id: 2,
      invoiceId: 1,
      projectId: null,
      timeEntryId: null,
      description: 'Updated',
      quantity: 2,
      unitPrice: 50,
      total: 100,
    };
    service.updateItem.mockResolvedValue(item);

    const result = await resolver.updateInvoiceItem({
      id: 2,
      description: 'Updated',
    });
    expect(service.updateItem).toHaveBeenCalledWith(2, {
      id: 2,
      description: 'Updated',
    });
    expect(result).toEqual(item);
  });

  it('removeInvoiceItem — delegates to service', async () => {
    service.removeItem.mockResolvedValue(true);

    const result = await resolver.removeInvoiceItem(2);
    expect(service.removeItem).toHaveBeenCalledWith(2);
    expect(result).toBe(true);
  });
});
