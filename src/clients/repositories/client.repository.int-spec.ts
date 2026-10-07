import { NotFoundException } from '@nestjs/common';
import { toDb } from '../../prisma8/timestamp';
import {
  seedClient,
  seedOccupation,
  seedProject,
  seedTag,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { ClientStatus, ClientType } from '../entities/client.entity';
import { ClientRepository } from './client.repository';
import { PrismaClientRepository } from './prisma-client.repository';

const db = useTestDb();

describe.each([
  ['prisma7', (): ClientRepository => new PrismaClientRepository(db.prisma7)],
])('ClientRepository (%s)', (_impl, make) => {
  let repo: ClientRepository;
  let owner: number;
  let stranger: number;

  const ids = (page: { items: { id: number }[] }) =>
    page.items.map((c) => c.id);

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  describe('create / findById', () => {
    it('defaults type/status/billing, links tags and occupations, taxRate as a number', async () => {
      const tag = await seedTag(db.prisma8, owner, 'vip');
      const occupation = await seedOccupation(db.prisma8, owner, 'Translator');
      const client = await repo.create(owner, {
        name: 'ACME',
        email: 'a@acme.io',
        taxRate: 20.5,
        tagIds: [tag.id],
        occupationIds: [occupation.id],
      });
      expect(client).toMatchObject({
        userId: owner,
        name: 'ACME',
        email: 'a@acme.io',
        clientType: 'COMPANY',
        status: 'CLIENT',
        billingEndOfMonth: false,
        taxRate: 20.5,
        contactedAt: null,
        contacts: [],
        tags: [{ id: tag.id, name: 'vip' }],
      });
      expect(client.occupations).toEqual([
        expect.objectContaining({ id: occupation.id, name: 'Translator' }),
      ]);
      await expect(repo.findById(client.id, owner)).resolves.toMatchObject({
        name: 'ACME',
        taxRate: 20.5,
      });
    });

    it("throws NotFound for someone else's client; taxRate null when unset", async () => {
      const theirs = await seedClient(db.prisma8, stranger);
      await expect(repo.findById(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.findById(theirs.id, stranger)).resolves.toMatchObject({
        taxRate: null,
        tags: [],
        occupations: [],
      });
    });
  });

  describe('hubspot lookups', () => {
    it('finds by HubSpot id per user, or globally', async () => {
      const mine = await seedClient(db.prisma8, owner, { hubspotId: 'hs-1' });
      await expect(repo.findByHubspotId(owner, 'hs-1')).resolves.toMatchObject({
        id: mine.id,
      });
      await expect(repo.findByHubspotId(stranger, 'hs-1')).resolves.toBeNull();
      await expect(repo.findByHubspotIdGlobal('hs-1')).resolves.toMatchObject({
        id: mine.id,
      });
      await expect(repo.findByHubspotIdGlobal('nope')).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    it('pages by id with total, admin sees everyone', async () => {
      const a = await seedClient(db.prisma8, owner);
      const b = await seedClient(db.prisma8, owner);
      const c = await seedClient(db.prisma8, owner);
      await seedClient(db.prisma8, stranger);

      const page1 = await repo.findAll(owner, false, { limit: 2 });
      expect(ids(page1)).toEqual([a.id, b.id]);
      expect(page1).toMatchObject({ total: 3, nextCursor: b.id });
      await expect(
        repo.findAll(owner, false, { limit: 2, cursor: b.id }),
      ).resolves.toMatchObject({
        items: [expect.objectContaining({ id: c.id })],
        nextCursor: null,
      });
      await expect(repo.findAll(owner, true)).resolves.toMatchObject({
        total: 4,
      });
    });

    it('filters by name search, type, status and excluded status', async () => {
      const acme = await seedClient(db.prisma8, owner, {
        name: 'Acme Corp',
        status: 'TO_CONTACT',
      });
      const jane = await seedClient(db.prisma8, owner, {
        name: 'jane acme',
        clientType: 'INDIVIDUAL',
      });
      const other = await seedClient(db.prisma8, owner, { name: 'Other' });

      await expect(
        repo.findAll(owner, false, undefined, 'ACME').then(ids),
      ).resolves.toEqual([acme.id, jane.id]);
      await expect(
        repo
          .findAll(owner, false, undefined, undefined, 'INDIVIDUAL')
          .then(ids),
      ).resolves.toEqual([jane.id]);
      await expect(
        repo
          .findAll(
            owner,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            'TO_CONTACT',
          )
          .then(ids),
      ).resolves.toEqual([acme.id]);
      await expect(
        repo
          .findAll(owner, false, undefined, undefined, undefined, 'TO_CONTACT')
          .then(ids),
      ).resolves.toEqual([jane.id, other.id]);
    });
  });

  describe('update', () => {
    it('changes fields and replaces tags / occupations only when given', async () => {
      const t1 = await seedTag(db.prisma8, owner, 't1');
      const t2 = await seedTag(db.prisma8, owner, 't2');
      const client = await repo.create(owner, { name: 'Old', tagIds: [t1.id] });
      await new Promise((r) => setTimeout(r, 5));

      const renamed = await repo.update(client.id, owner, {
        id: client.id,
        name: 'New',
        status: ClientStatus.TALKING,
        taxRate: 5.5,
      });
      expect(renamed).toMatchObject({
        name: 'New',
        status: 'TALKING',
        taxRate: 5.5,
        tags: [{ id: t1.id, name: 't1' }],
      });
      expect(renamed.updatedAt.getTime()).toBeGreaterThan(
        client.updatedAt.getTime(),
      );

      const retagged = await repo.update(client.id, owner, {
        id: client.id,
        tagIds: [t2.id],
        occupationIds: [],
      });
      expect(retagged.tags).toEqual([{ id: t2.id, name: 't2' }]);
      expect(retagged.occupations).toEqual([]);
    });

    it("throws NotFound for someone else's client", async () => {
      const theirs = await seedClient(db.prisma8, stranger);
      await expect(
        repo.update(theirs.id, owner, { id: theirs.id, name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('unlinks its projects, deletes the client and returns it', async () => {
      const client = await repo.create(owner, {
        name: 'Gone',
        clientType: ClientType.INDIVIDUAL,
      });
      const project = await seedProject(db.prisma8, owner, {
        clientId: client.id,
      });

      await expect(repo.delete(client.id, owner)).resolves.toMatchObject({
        id: client.id,
        name: 'Gone',
      });

      await expect(repo.findById(client.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const row = await db.prisma8.orm.public.Project.first({ id: project.id });
      expect(row).toMatchObject({ id: project.id, clientId: null });
    });

    it("throws NotFound for someone else's client", async () => {
      const theirs = await seedClient(db.prisma8, stranger);
      await expect(repo.delete(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('contacts', () => {
    it("creates, updates and deletes a contact on the user's client", async () => {
      const client = await seedClient(db.prisma8, owner);
      const contact = await repo.createContact(
        { clientId: client.id, firstName: 'Ann', email: 'ann@x.io' },
        owner,
      );
      expect(contact).toMatchObject({
        clientId: client.id,
        firstName: 'Ann',
        lastName: null,
        email: 'ann@x.io',
      });

      await expect(
        repo.updateContact(contact.id, owner, {
          id: contact.id,
          lastName: 'Lee',
          jobTitle: 'PM',
        }),
      ).resolves.toMatchObject({
        firstName: 'Ann',
        lastName: 'Lee',
        jobTitle: 'PM',
      });
      await expect(repo.findById(client.id, owner)).resolves.toMatchObject({
        contacts: [
          expect.objectContaining({ id: contact.id, lastName: 'Lee' }),
        ],
      });

      await expect(
        repo.deleteContact(contact.id, owner),
      ).resolves.toMatchObject({ id: contact.id });
      await expect(repo.findById(client.id, owner)).resolves.toMatchObject({
        contacts: [],
      });
    });

    it("refuses someone else's client or contact", async () => {
      const theirs = await seedClient(db.prisma8, stranger);
      const contact = await repo.createContact(
        { clientId: theirs.id, firstName: 'Bob' },
        stranger,
      );
      await expect(
        repo.createContact({ clientId: theirs.id, firstName: 'x' }, owner),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        repo.updateContact(contact.id, owner, {
          id: contact.id,
          firstName: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        repo.deleteContact(contact.id, owner),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.findById(theirs.id, stranger)).resolves.toMatchObject({
        contacts: [expect.objectContaining({ firstName: 'Bob' })],
      });
    });
  });

  describe('follow-up automation', () => {
    it('finds FOLLOW_UP_3 clients contacted before the cutoff, across users', async () => {
      const cutoff = new Date('2026-06-01T00:00:00.000Z');
      const stale = await seedClient(db.prisma8, owner, {
        status: 'FOLLOW_UP_3',
        contactedAt: toDb(new Date('2026-05-01T00:00:00.000Z')),
      });
      const staleOther = await seedClient(db.prisma8, stranger, {
        status: 'FOLLOW_UP_3',
        contactedAt: toDb(new Date('2026-05-31T23:59:59.000Z')),
      });
      await seedClient(db.prisma8, owner, {
        status: 'FOLLOW_UP_3',
        contactedAt: toDb(cutoff),
      });
      await seedClient(db.prisma8, owner, {
        status: 'FOLLOW_UP_2',
        contactedAt: toDb(new Date('2026-01-01T00:00:00.000Z')),
      });
      await seedClient(db.prisma8, owner, { status: 'FOLLOW_UP_3' });

      const found = await repo.findStaleFollowUpClientIds(cutoff);

      expect(found.sort((x, y) => x.id - y.id)).toEqual([
        { id: stale.id, userId: owner },
        { id: staleOther.id, userId: stranger },
      ]);
    });

    it('promotes the given clients to RECONTACT_LATER and returns the count', async () => {
      const a = await seedClient(db.prisma8, owner, { status: 'FOLLOW_UP_3' });
      const b = await seedClient(db.prisma8, owner, { status: 'FOLLOW_UP_3' });
      await expect(repo.promoteClients([a.id])).resolves.toBe(1);
      await expect(repo.findById(a.id, owner)).resolves.toMatchObject({
        status: 'RECONTACT_LATER',
      });
      await expect(repo.findById(b.id, owner)).resolves.toMatchObject({
        status: 'FOLLOW_UP_3',
      });
      await expect(repo.promoteClients([])).resolves.toBe(0);
    });
  });
});
