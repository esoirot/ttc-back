import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { ClientRepository } from './repositories/client.repository';
import { ClientStatusHistoryService } from './client-status-history.service';
import { ClientStatus, ClientIndustry } from './entities/client.entity';
import { AuditService } from '../audit/audit.service';
import { mockClient } from '../__test-helpers__/mock-factories';
import { UpdateClientInput } from './dto/update-client.input';

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
  let statusHistory: { log: jest.Mock; logMany: jest.Mock };

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
    statusHistory = { log: jest.fn(), logMany: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: ClientRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: ClientStatusHistoryService, useValue: statusHistory },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    repo.findById.mockResolvedValue(mockClient());
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

    it('does not log status history when status/contactedAt are unchanged', async () => {
      repo.findById.mockResolvedValue(
        mockClient({ id: 3, status: 'CLIENT', contactedAt: null }),
      );
      repo.update.mockResolvedValue(mockClient({ id: 3 }));

      await service.update(3, 1, { id: 3, name: 'Updated Corp' });

      expect(statusHistory.log).not.toHaveBeenCalled();
    });

    it('logs STATUS_CHANGED when status changes', async () => {
      repo.findById.mockResolvedValue(mockClient({ id: 3, status: 'CLIENT' }));
      repo.update.mockResolvedValue(mockClient({ id: 3, status: 'TALKING' }));

      await service.update(3, 1, { id: 3, status: ClientStatus.TALKING });

      expect(statusHistory.log).toHaveBeenCalledWith(3, 1, 'STATUS_CHANGED', {
        from: 'CLIENT',
        to: ClientStatus.TALKING,
      });
    });

    describe('newer contact date steps the prospect status', () => {
      const may1 = new Date('2026-05-01T00:00:00.000Z');
      const may3 = new Date('2026-05-03T00:00:00.000Z');

      const save = async (
        before: Parameters<typeof mockClient>[0],
        input: Omit<UpdateClientInput, 'id'>,
      ) => {
        repo.findById.mockResolvedValue(mockClient({ id: 3, ...before }));
        repo.update.mockResolvedValue(mockClient({ id: 3 }));
        await service.update(3, 1, { id: 3, ...input });
        return (
          repo.update.mock.calls[0] as [number, number, UpdateClientInput]
        )[2].status;
      };

      it.each([
        ['TO_CONTACT', ClientStatus.CONTACTED],
        ['FORMER_CLIENT', ClientStatus.CONTACTED],
        ['CONTACTED', ClientStatus.FOLLOW_UP_1],
        ['FOLLOW_UP_1', ClientStatus.FOLLOW_UP_2],
        ['FOLLOW_UP_2', ClientStatus.RECONTACT_LATER],
        ['RECONTACT_LATER', ClientStatus.CONTACTED],
      ] as const)('%s moves to %s', async (from, to) => {
        await expect(
          save({ status: from, contactedAt: may1 }, { contactedAt: may3 }),
        ).resolves.toBe(to);
        expect(statusHistory.log).toHaveBeenCalledWith(3, 1, 'STATUS_CHANGED', {
          from,
          to,
        });
      });

      it('counts a first contact date as newer', async () => {
        await expect(
          save(
            { status: 'TO_CONTACT', contactedAt: null },
            { contactedAt: may3 },
          ),
        ).resolves.toBe(ClientStatus.CONTACTED);
      });

      it('steps even when the form sends the unchanged status', async () => {
        await expect(
          save(
            { status: 'CONTACTED', contactedAt: may1 },
            { contactedAt: may3, status: ClientStatus.CONTACTED },
          ),
        ).resolves.toBe(ClientStatus.FOLLOW_UP_1);
      });

      it.each([
        ['an older date', may1, may3],
        ['the same date', may3, may3],
        ['a cleared date', null as unknown as Date, may3],
      ])('does not move on %s', async (_, date, stored) => {
        await expect(
          save(
            { status: 'FOLLOW_UP_1', contactedAt: stored },
            { contactedAt: date },
          ),
        ).resolves.toBeUndefined();
        expect(statusHistory.log).not.toHaveBeenCalledWith(
          3,
          1,
          'STATUS_CHANGED',
          expect.anything(),
        );
      });

      it.each(['TALKING', 'CLIENT'] as const)(
        '%s never moves',
        async (status) => {
          await expect(
            save({ status, contactedAt: may1 }, { contactedAt: may3 }),
          ).resolves.toBeUndefined();
        },
      );

      it('lets a status picked in the same edit win', async () => {
        await expect(
          save(
            { status: 'CONTACTED', contactedAt: may1 },
            { contactedAt: may3, status: ClientStatus.TALKING },
          ),
        ).resolves.toBe(ClientStatus.TALKING);
      });

      it('does not move when only the recontact date changes', async () => {
        await expect(
          save(
            { status: 'FOLLOW_UP_1', contactedAt: may1 },
            { toRecontactAt: may3 },
          ),
        ).resolves.toBeUndefined();
      });
    });

    it('does not log STATUS_CHANGED when status is present but unchanged', async () => {
      repo.findById.mockResolvedValue(mockClient({ id: 3, status: 'CLIENT' }));
      repo.update.mockResolvedValue(mockClient({ id: 3, status: 'CLIENT' }));

      await service.update(3, 1, { id: 3, status: ClientStatus.CLIENT });

      expect(statusHistory.log).not.toHaveBeenCalled();
    });

    it('logs CONTACTED_AT_CHANGED when contactedAt changes from null to a date', async () => {
      const newDate = new Date('2026-07-15T00:00:00.000Z');
      repo.findById.mockResolvedValue(mockClient({ id: 3, contactedAt: null }));
      repo.update.mockResolvedValue(
        mockClient({ id: 3, contactedAt: newDate }),
      );

      await service.update(3, 1, { id: 3, contactedAt: newDate });

      expect(statusHistory.log).toHaveBeenCalledWith(
        3,
        1,
        'CONTACTED_AT_CHANGED',
        { from: null, to: newDate.toISOString() },
      );
    });

    it('logs CONTACTED_AT_CHANGED when contactedAt is cleared (date to null)', async () => {
      const oldDate = new Date('2026-07-01T00:00:00.000Z');
      repo.findById.mockResolvedValue(
        mockClient({ id: 3, contactedAt: oldDate }),
      );
      repo.update.mockResolvedValue(mockClient({ id: 3, contactedAt: null }));

      await service.update(3, 1, {
        id: 3,
        contactedAt: null as unknown as Date,
      });

      expect(statusHistory.log).toHaveBeenCalledWith(
        3,
        1,
        'CONTACTED_AT_CHANGED',
        { from: oldDate.toISOString(), to: null },
      );
    });

    it('does not log CONTACTED_AT_CHANGED when contactedAt is present but unchanged', async () => {
      const sameDate = new Date('2026-07-01T00:00:00.000Z');
      repo.findById.mockResolvedValue(
        mockClient({ id: 3, contactedAt: sameDate }),
      );
      repo.update.mockResolvedValue(
        mockClient({ id: 3, contactedAt: sameDate }),
      );

      await service.update(3, 1, { id: 3, contactedAt: sameDate });

      expect(statusHistory.log).not.toHaveBeenCalled();
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
    it('passes the page and every filter to the repository', async () => {
      const connection = { items: [], nextCursor: null, total: 0 };
      repo.findAll.mockResolvedValue(connection);
      const filters = {
        search: 'ACME',
        lastName: 'Curie',
        industry: ClientIndustry.LEGAL,
        status: ClientStatus.CLIENT,
      };

      await expect(
        service.findAll(1, false, { limit: 10 }, filters),
      ).resolves.toBe(connection);
      expect(repo.findAll).toHaveBeenCalledWith(
        1,
        false,
        { limit: 10 },
        filters,
        undefined,
      );
    });

    it('passes the sort to the repository', async () => {
      repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
      const sort = { field: 'LAST_NAME', direction: 'DESC' } as const;
      await service.findAll(1, false, undefined, {}, sort);
      expect(repo.findAll).toHaveBeenCalledWith(1, false, undefined, {}, sort);
    });

    it('defaults to no filters', async () => {
      repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
      await service.findAll(1, true);
      expect(repo.findAll).toHaveBeenCalledWith(
        1,
        true,
        undefined,
        {},
        undefined,
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

  describe('findByHubspotIdGlobal', () => {
    it('delegates to repository', async () => {
      const client = mockClient({ hubspotId: 'hs-789' });
      repo.findByHubspotIdGlobal.mockResolvedValue(client);

      const result = await service.findByHubspotIdGlobal('hs-789');

      expect(repo.findByHubspotIdGlobal).toHaveBeenCalledWith('hs-789');
      expect(result).toEqual(client);
    });

    it('returns null when no client matches', async () => {
      repo.findByHubspotIdGlobal.mockResolvedValue(null);

      const result = await service.findByHubspotIdGlobal('unknown');

      expect(result).toBeNull();
    });
  });

  describe('createContact', () => {
    it('delegates to repository with input and userId', async () => {
      const contact = { id: 1, clientId: 1, firstName: 'Jane' };
      repo.createContact.mockResolvedValue(contact);

      const result = await service.createContact(1, {
        clientId: 1,
        firstName: 'Jane',
      });

      expect(repo.createContact).toHaveBeenCalledWith(
        { clientId: 1, firstName: 'Jane' },
        1,
      );
      expect(result).toEqual(contact);
    });
  });

  describe('updateContact', () => {
    it('delegates to repository with id, userId, and input', async () => {
      const contact = {
        id: 2,
        clientId: 1,
        firstName: 'Jane',
        lastName: 'Doe',
      };
      repo.updateContact.mockResolvedValue(contact);

      const result = await service.updateContact(2, 1, {
        id: 2,
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(repo.updateContact).toHaveBeenCalledWith(2, 1, {
        id: 2,
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(result).toEqual(contact);
    });
  });
});
