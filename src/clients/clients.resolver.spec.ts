import { Test, TestingModule } from '@nestjs/testing';
import { ClientsResolver } from './clients.resolver';
import { ClientsService } from './clients.service';
import {
  ClientIndustry,
  ClientStatus,
  ClientType,
  Client,
} from './entities/client.entity';
import { mockClient } from '../__test-helpers__/mock-factories';
import type { GqlContext } from '../auth/types/gql-context.type';

describe('ClientsResolver', () => {
  let resolver: ClientsResolver;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createContact: jest.Mock;
    updateContact: jest.Mock;
    deleteContact: jest.Mock;
    findByHubspotIdGlobal: jest.Mock;
  };
  const user = { id: 1, role: 'USER' };
  const adminUser = { id: 2, role: 'ADMIN' };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createContact: jest.fn(),
      updateContact: jest.fn(),
      deleteContact: jest.fn(),
      findByHubspotIdGlobal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsResolver,
        { provide: ClientsService, useValue: service },
      ],
    }).compile();

    resolver = module.get<ClientsResolver>(ClientsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  const noFilters = {
    search: undefined,
    companyName: undefined,
    firstName: undefined,
    lastName: undefined,
    clientType: undefined,
    status: undefined,
    excludeStatus: undefined,
    industry: undefined,
  };

  it('findAll — passes isAdmin=false for USER', async () => {
    service.findAll.mockResolvedValue({ items: [] });
    await resolver.findAll(user, undefined, 'ACME');
    expect(service.findAll).toHaveBeenCalledWith(1, false, undefined, {
      ...noFilters,
      search: 'ACME',
    });
  });

  it('findAll — passes isAdmin=true for ADMIN', async () => {
    service.findAll.mockResolvedValue({ items: [] });
    await resolver.findAll(adminUser);
    expect(service.findAll).toHaveBeenCalledWith(2, true, undefined, noFilters);
  });

  it('findAll — passes every filter through by name', async () => {
    service.findAll.mockResolvedValue({ items: [] });

    await resolver.findAll(
      user,
      { limit: 5 },
      'q',
      ClientType.INDIVIDUAL,
      ClientStatus.CLIENT,
      ClientStatus.TO_CONTACT,
      ClientIndustry.LEGAL,
      'Acme',
      'Marie',
      'Curie',
    );
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      false,
      { limit: 5 },
      {
        search: 'q',
        clientType: ClientType.INDIVIDUAL,
        excludeStatus: ClientStatus.CLIENT,
        status: ClientStatus.TO_CONTACT,
        industry: ClientIndustry.LEGAL,
        companyName: 'Acme',
        firstName: 'Marie',
        lastName: 'Curie',
      },
    );
  });

  it('findOne — delegates to service', async () => {
    const client = mockClient();
    service.findOne.mockResolvedValue(client);

    const result = await resolver.findOne(1, user);
    expect(service.findOne).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(client);
  });

  it('createClient — delegates to service', async () => {
    const client = mockClient({ name: 'New Corp' });
    service.create.mockResolvedValue(client);

    const result = await resolver.createClient({ name: 'New Corp' }, user);
    expect(service.create).toHaveBeenCalledWith(1, { name: 'New Corp' });
    expect(result).toEqual(client);
  });

  it('updateClient — delegates with id from input', async () => {
    const client = mockClient({ name: 'Updated' });
    service.update.mockResolvedValue(client);

    const result = await resolver.updateClient(
      { id: 3, name: 'Updated' },
      user,
    );
    expect(service.update).toHaveBeenCalledWith(3, 1, {
      id: 3,
      name: 'Updated',
    });
    expect(result).toEqual(client);
  });

  it('deleteClient — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteClient(3, user);
    expect(service.delete).toHaveBeenCalledWith(3, 1);
    expect(result).toBe(true);
  });

  it('createCompanyContact — delegates to service', async () => {
    const contact = {
      id: 1,
      clientId: 1,
      firstName: 'Jane',
      lastName: null,
      email: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    service.createContact.mockResolvedValue(contact);

    const result = await resolver.createCompanyContact(
      { clientId: 1, firstName: 'Jane' },
      user,
    );
    expect(service.createContact).toHaveBeenCalledWith(1, {
      clientId: 1,
      firstName: 'Jane',
    });
    expect(result).toEqual(contact);
  });

  it('updateCompanyContact — delegates with id from input', async () => {
    const contact = {
      id: 2,
      clientId: 1,
      firstName: 'Jane',
      lastName: 'Doe',
      email: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    service.updateContact.mockResolvedValue(contact);

    const result = await resolver.updateCompanyContact(
      { id: 2, firstName: 'Jane', lastName: 'Doe' },
      user,
    );
    expect(service.updateContact).toHaveBeenCalledWith(2, 1, {
      id: 2,
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result).toEqual(contact);
  });

  it('deleteCompanyContact — delegates to service', async () => {
    service.deleteContact.mockResolvedValue(true);

    const result = await resolver.deleteCompanyContact(5, user);
    expect(service.deleteContact).toHaveBeenCalledWith(5, 1);
    expect(result).toBe(true);
  });

  it('statusHistory — delegates to the statusHistoryByClient loader with the client id', async () => {
    const history = [{ id: 1, clientId: 3, type: 'STATUS_CHANGED' }];
    const load = jest.fn().mockResolvedValue(history);
    const ctx = {
      loaders: { statusHistoryByClient: { load } },
    } as unknown as GqlContext;

    const result = await resolver.statusHistory(
      mockClient({ id: 3 }) as unknown as Client,
      ctx,
    );
    expect(load).toHaveBeenCalledWith(3);
    expect(result).toEqual(history);
  });
});
