import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { ClientRepository } from './repositories/client.repository';
import { ClientStatus } from './entities/client.entity';
import { AuditService } from '../audit/audit.service';
import { mockClient } from '../__test-helpers__/mock-factories';

describe('ClientsService', () => {
  let service: ClientsService;
  let repo: {
    findById: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findByHubspotId: jest.Mock;
    findByHubspotIdGlobal: jest.Mock;
    createContact: jest.Mock;
    updateContact: jest.Mock;
    deleteContact: jest.Mock;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByHubspotId: jest.fn(),
      findByHubspotIdGlobal: jest.fn(),
      createContact: jest.fn(),
      updateContact: jest.fn(),
      deleteContact: jest.fn(),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: ClientRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates client and logs CLIENT_CREATE audit', async () => {
      const client = mockClient({ id: 3, name: 'ACME Corp' });
      repo.create.mockResolvedValue(client);

      const result = await service.create(1, { name: 'ACME Corp' });

      expect(repo.create).toHaveBeenCalledWith(1, { name: 'ACME Corp' });
      expect(audit.log).toHaveBeenCalledWith(1, 'CLIENT_CREATE', 'client', {
        clientId: 3,
        name: 'ACME Corp',
      });
      expect(result).toEqual(client);
    });
  });

  describe('update', () => {
    it('updates client and logs CLIENT_UPDATE audit', async () => {
      const client = mockClient({ id: 3, name: 'Updated Corp' });
      repo.update.mockResolvedValue(client);

      const result = await service.update(3, 1, {
        id: 3,
        name: 'Updated Corp',
      });

      expect(repo.update).toHaveBeenCalledWith(3, 1, {
        id: 3,
        name: 'Updated Corp',
      });
      expect(audit.log).toHaveBeenCalledWith(1, 'CLIENT_UPDATE', 'client', {
        clientId: 3,
        name: 'Updated Corp',
      });
      expect(result).toEqual(client);
    });
  });

  describe('delete', () => {
    it('deletes client and logs CLIENT_DELETE audit', async () => {
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(3, 1);

      expect(repo.delete).toHaveBeenCalledWith(3, 1);
      expect(audit.log).toHaveBeenCalledWith(1, 'CLIENT_DELETE', 'client', {
        clientId: 3,
      });
      expect(result).toBe(true);
    });
  });

  describe('findOne', () => {
    it('delegates to repository', async () => {
      const client = mockClient();
      repo.findById.mockResolvedValue(client);

      const result = await service.findOne(1, 1);
      expect(repo.findById).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(client);
    });
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      const connection = { edges: [], pageInfo: { hasNextPage: false } };
      repo.findAll.mockResolvedValue(connection);

      const result = await service.findAll(
        1,
        false,
        { limit: 10 },
        'ACME',
        undefined,
      );
      expect(repo.findAll).toHaveBeenCalledWith(
        1,
        false,
        { limit: 10 },
        'ACME',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(connection);
    });

    it('passes excludeStatus and status filters to repository', async () => {
      repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

      await service.findAll(
        1,
        false,
        undefined,
        undefined,
        undefined,
        ClientStatus.CLIENT,
        ClientStatus.TO_CONTACT,
      );
      expect(repo.findAll).toHaveBeenCalledWith(
        1,
        false,
        undefined,
        undefined,
        undefined,
        ClientStatus.CLIENT,
        ClientStatus.TO_CONTACT,
      );
    });
  });

  describe('importFromHubspot', () => {
    it('returns existing client if already imported', async () => {
      const existing = mockClient({ hubspotId: 'hs-123' });
      repo.findByHubspotId.mockResolvedValue(existing);

      const result = await service.importFromHubspot(1, 'hs-123', {
        name: 'Client',
      });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('creates client when not yet imported', async () => {
      const newClient = mockClient({ hubspotId: 'hs-456' });
      repo.findByHubspotId.mockResolvedValue(null);
      repo.create.mockResolvedValue(newClient);

      const result = await service.importFromHubspot(1, 'hs-456', {
        name: 'New Client',
      });

      expect(repo.create).toHaveBeenCalledWith(1, {
        name: 'New Client',
        hubspotId: 'hs-456',
      });
      expect(result).toEqual(newClient);
    });
  });

  describe('deleteContact', () => {
    it('returns true after deleting contact', async () => {
      repo.deleteContact.mockResolvedValue(undefined);

      const result = await service.deleteContact(5, 1);

      expect(repo.deleteContact).toHaveBeenCalledWith(5, 1);
      expect(result).toBe(true);
    });
  });
});
