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
import {
  ClientIndustry,
  ClientStatus,
  ClientType,
} from '../entities/client.entity';
import { ClientRepository, ClientSort } from './client.repository';
import { Prisma8ClientRepository } from './prisma8-client.repository';

const db = useTestDb();

describe.each([
  ['prisma8', (): ClientRepository => new Prisma8ClientRepository(db.prisma8)],
])('ClientRepository (%s)', (_impl, make) => {
  let repo: ClientRepository;
  let owner: number;
  let stranger: number;

  const ids = (page: { items: { id: number }[] }) =>
    page.items.map((c) => c.id);

  // A third user's client with a tag, an occupation, a contact and a
  // project, created first: a write that loses its filter lands here.
  const snapshot = async (clientId: number) => ({
    client: await db.prisma8.orm.public.Client.first({ id: clientId }),
    tags: await db.prisma8.orm.public.ClientTag.where({ clientId }).all(),
    occupations: await db.prisma8.orm.public.ClientOccupation.where({
      clientId,
    }).all(),
    contacts: await db.prisma8.orm.public.CompanyContact.where({
      clientId,
    }).all(),
    projects: await db.prisma8.orm.public.Project.where({ clientId }).all(),
  });
  let decoy: { id: number; before: Awaited<ReturnType<typeof snapshot>> };

  beforeEach(async () => {
    repo = make();
    const other = (await seedUser(db.prisma8)).id;
    const id = (await seedClient(db.prisma8, other, { name: 'decoy' })).id;
    await db.prisma8.orm.public.ClientTag.create({
      clientId: id,
      tagId: (await seedTag(db.prisma8, other, 'decoy')).id,
    });
    await db.prisma8.orm.public.ClientOccupation.create({
      clientId: id,
      occupationId: (await seedOccupation(db.prisma8, other)).id,
    });
    await db.prisma8.orm.public.CompanyContact.create({
      clientId: id,
      firstName: 'Decoy',
      updatedAt: toDb(new Date()),
    });
    await seedProject(db.prisma8, other, { clientId: id });
    decoy = { id, before: await snapshot(id) };
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  afterEach(async () => {
    await expect(snapshot(decoy.id)).resolves.toEqual(decoy.before);
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
        total: 5,
      });
    });

    it('has no next cursor when the page holds exactly the limit', async () => {
      await seedClient(db.prisma8, owner);
      await seedClient(db.prisma8, owner);
      await expect(
        repo.findAll(owner, false, { limit: 2 }),
      ).resolves.toMatchObject({ nextCursor: null, total: 2 });
    });

    it("searches a company's name or a person's first or last name", async () => {
      const acme = await seedClient(db.prisma8, owner, { name: 'Acme' });
      const marie = await seedClient(db.prisma8, owner, {
        name: 'M. C.',
        clientType: 'INDIVIDUAL',
        firstName: 'Marie',
        lastName: 'Curie',
      });
      const pierre = await seedClient(db.prisma8, owner, {
        name: 'P.',
        clientType: 'INDIVIDUAL',
        firstName: 'Pierre',
        lastName: 'Acmeville',
      });
      const search = (q: string) =>
        repo.findAll(owner, false, undefined, { search: q }).then(ids);

      await expect(search('curie')).resolves.toEqual([marie.id]);
      await expect(search('MARIE')).resolves.toEqual([marie.id]);
      await expect(search('acme')).resolves.toEqual([acme.id, pierre.id]);
    });

    it('filters companies by name, people by last and first name', async () => {
      const acme = await seedClient(db.prisma8, owner, { name: 'Acme' });
      await seedClient(db.prisma8, owner, { name: 'Globex' });
      const person = (firstName: string, lastName: string) =>
        seedClient(db.prisma8, owner, {
          name: `${firstName} ${lastName}`,
          clientType: 'INDIVIDUAL',
          firstName,
          lastName,
        });
      const marieCurie = await person('Marie', 'Curie');
      const pierreCurie = await person('Pierre', 'Curie');
      await person('Marie', 'Dupont');
      const find = (filters: Parameters<ClientRepository['findAll']>[3]) =>
        repo.findAll(owner, false, undefined, filters).then(ids);

      await expect(find({ companyName: 'ACM' })).resolves.toEqual([acme.id]);
      await expect(find({ lastName: 'curie' })).resolves.toEqual([
        marieCurie.id,
        pierreCurie.id,
      ]);
      await expect(
        find({ lastName: 'curie', firstName: 'MARIE' }),
      ).resolves.toEqual([marieCurie.id]);
    });

    it('lists individuals by last name then first name, no last name last, across pages', async () => {
      const person = (firstName: string, lastName: string | null) =>
        seedClient(db.prisma8, owner, {
          name: firstName,
          clientType: 'INDIVIDUAL',
          firstName,
          lastName,
        });
      const carl = await person('Carl', null);
      const anne = await person('Anne', 'Martin');
      const zoe = await person('Zoé', 'Abel');
      const bob = await person('Bob', 'Abel');
      const dan = await person('Dan', null);
      await seedClient(db.prisma8, owner, { name: 'A company' });

      const seen: number[] = [];
      let cursor: number | undefined;
      for (let i = 0; i < 10; i++) {
        const page = await repo.findAll(
          owner,
          false,
          { limit: 2, cursor },
          { clientType: 'INDIVIDUAL' },
        );
        seen.push(...ids(page));
        expect(page.total).toBe(5);
        if (page.nextCursor === null) break;
        cursor = page.nextCursor;
      }
      expect(seen).toEqual([bob.id, zoe.id, anne.id, carl.id, dan.id]);
    });

    it('has no next cursor when the last page of people holds exactly the limit', async () => {
      for (const lastName of ['Abel', 'Brun'])
        await seedClient(db.prisma8, owner, {
          name: lastName,
          clientType: 'INDIVIDUAL',
          firstName: 'X',
          lastName,
        });
      await expect(
        repo.findAll(owner, false, { limit: 2 }, { clientType: 'INDIVIDUAL' }),
      ).resolves.toMatchObject({ nextCursor: null, total: 2 });
    });

    describe('sort', () => {
      const person = (firstName: string | null, lastName: string | null) =>
        seedClient(db.prisma8, owner, {
          name: [firstName, lastName].filter(Boolean).join(' '),
          clientType: 'INDIVIDUAL',
          firstName,
          lastName,
        });
      const titles = (page: { items: { name: string }[] }) =>
        page.items.map((c) => c.name);
      const sorted = (
        sort: ClientSort,
        filters: Parameters<ClientRepository['findAll']>[3] = {},
      ) => repo.findAll(owner, false, undefined, filters, sort).then(titles);

      it('sorts by company name ignoring case and accents, both ways', async () => {
        for (const name of ['beta', 'Émile & co', 'Alpha'])
          await seedClient(db.prisma8, owner, { name });

        await expect(
          sorted({ field: 'NAME', direction: 'ASC' }),
        ).resolves.toEqual(['Alpha', 'beta', 'Émile & co']);
        await expect(
          sorted({ field: 'NAME', direction: 'DESC' }),
        ).resolves.toEqual(['Émile & co', 'beta', 'Alpha']);
      });

      it('sorts people by first or last name, empty names last both ways', async () => {
        await person('Anne', 'Martin');
        await person('Bob', 'Abel');
        await person('Carl', null);
        await person(null, 'Zola');
        const people = { clientType: 'INDIVIDUAL' };

        await expect(
          sorted({ field: 'FIRST_NAME', direction: 'DESC' }, people),
        ).resolves.toEqual(['Carl', 'Bob Abel', 'Anne Martin', 'Zola']);
        await expect(
          sorted({ field: 'LAST_NAME', direction: 'ASC' }, people),
        ).resolves.toEqual(['Bob Abel', 'Anne Martin', 'Zola', 'Carl']);
        await expect(
          sorted({ field: 'LAST_NAME', direction: 'DESC' }, people),
        ).resolves.toEqual(['Zola', 'Anne Martin', 'Bob Abel', 'Carl']);
      });

      it('breaks name ties on the other name, then oldest first', async () => {
        await person('Zoé', 'Abel');
        await person('Bob', 'Abel');
        await expect(
          sorted(
            { field: 'LAST_NAME', direction: 'ASC' },
            { clientType: 'INDIVIDUAL' },
          ),
        ).resolves.toEqual(['Bob Abel', 'Zoé Abel']);
      });

      it('falls back to the other name, then oldest first, ignoring case and accents', async () => {
        const people = { clientType: 'INDIVIDUAL' };
        await person('Eve', null);
        await person('Carl', null);
        await person('Zed', 'abel');
        await person('Amy', 'Abel');
        await person('Bea', 'Ross');
        await person('Bea', 'Cole');

        await expect(
          sorted({ field: 'LAST_NAME', direction: 'ASC' }, people),
        ).resolves.toEqual([
          'Amy Abel',
          'Zed abel',
          'Bea Cole',
          'Bea Ross',
          'Carl',
          'Eve',
        ]);
        await expect(
          sorted({ field: 'FIRST_NAME', direction: 'ASC' }, people),
        ).resolves.toEqual([
          'Amy Abel',
          'Bea Cole',
          'Bea Ross',
          'Carl',
          'Eve',
          'Zed abel',
        ]);
      });

      it('keeps same-name clients oldest first, accents ignored, either direction', async () => {
        await seedClient(db.prisma8, owner, { name: 'Emile' });
        await seedClient(db.prisma8, owner, { name: 'émile' });

        await expect(
          sorted({ field: 'NAME', direction: 'DESC' }),
        ).resolves.toEqual(['Emile', 'émile']);
      });

      it('pages through the sorted list, within the filters', async () => {
        for (const name of ['d', 'b', 'e', 'a', 'c'])
          await seedClient(db.prisma8, owner, { name, industry: 'LEGAL' });
        await seedClient(db.prisma8, owner, {
          name: 'aa',
          industry: 'FINANCE',
        });

        const seen: string[] = [];
        let cursor: number | undefined;
        for (let i = 0; i < 10; i++) {
          const page = await repo.findAll(
            owner,
            false,
            { limit: 2, cursor },
            { industry: 'LEGAL' },
            { field: 'NAME', direction: 'DESC' },
          );
          seen.push(...titles(page));
          if (page.nextCursor === null) break;
          cursor = page.nextCursor;
        }
        expect(seen).toEqual(['e', 'd', 'c', 'b', 'a']);
      });
    });

    it('stores the Translation agency industry', async () => {
      const client = await repo.create(owner, {
        name: 'Lingua',
        industry: ClientIndustry.TRANSLATION_AGENCY,
      });
      expect(client.industry).toBe('TRANSLATION_AGENCY');
    });

    it('filters by industry, together with the other filters', async () => {
      const legal = await seedClient(db.prisma8, owner, {
        name: 'Law firm',
        industry: 'LEGAL',
      });
      await seedClient(db.prisma8, owner, {
        name: 'Law school',
        industry: 'EDUCATION',
      });
      await seedClient(db.prisma8, owner, { name: 'No industry' });
      await seedClient(db.prisma8, stranger, {
        name: 'Their firm',
        industry: 'LEGAL',
      });

      await expect(
        repo
          .findAll(owner, false, undefined, {
            search: 'law',
            industry: 'LEGAL',
          })
          .then(ids),
      ).resolves.toEqual([legal.id]);
    });

    it('keeps former clients off the client list and on the prospect board', async () => {
      const current = await seedClient(db.prisma8, owner, { name: 'Current' });
      const former = await seedClient(db.prisma8, owner, { name: 'Former' });
      await repo.update(former.id, owner, {
        id: former.id,
        status: ClientStatus.FORMER_CLIENT,
      });

      // The Clients page asks for status CLIENT, /prospects for "not CLIENT".
      await expect(
        repo.findAll(owner, false, undefined, { status: 'CLIENT' }).then(ids),
      ).resolves.toEqual([current.id]);
      await expect(
        repo
          .findAll(owner, false, undefined, { excludeStatus: 'CLIENT' })
          .then(ids),
      ).resolves.toEqual([former.id]);
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
        repo.findAll(owner, false, undefined, { search: 'ACME' }).then(ids),
      ).resolves.toEqual([acme.id, jane.id]);
      await expect(
        repo
          .findAll(owner, false, undefined, { clientType: 'INDIVIDUAL' })
          .then(ids),
      ).resolves.toEqual([jane.id]);
      await expect(
        repo
          .findAll(owner, false, undefined, { status: 'TO_CONTACT' })
          .then(ids),
      ).resolves.toEqual([acme.id]);
      await expect(
        repo
          .findAll(owner, false, undefined, { excludeStatus: 'TO_CONTACT' })
          .then(ids),
      ).resolves.toEqual([jane.id, other.id]);
    });
  });

  describe('contact linkedinUrl', () => {
    it("stores, changes and clears a contact's LinkedIn URL", async () => {
      const client = await seedClient(db.prisma8, owner);
      const contact = await repo.createContact(
        {
          clientId: client.id,
          firstName: 'Jane',
          linkedinUrl: 'https://www.linkedin.com/in/jane',
        },
        owner,
      );
      expect(contact.linkedinUrl).toBe('https://www.linkedin.com/in/jane');
      await expect(
        repo.updateContact(contact.id, owner, {
          id: contact.id,
          linkedinUrl: 'https://www.linkedin.com/in/j',
        }),
      ).resolves.toMatchObject({
        linkedinUrl: 'https://www.linkedin.com/in/j',
      });
      await expect(
        repo.updateContact(contact.id, owner, {
          id: contact.id,
          linkedinUrl: null,
        }),
      ).resolves.toMatchObject({ linkedinUrl: null });
    });
  });

  describe('linkedinUrl', () => {
    it('stores, changes and clears the LinkedIn URL', async () => {
      const url = 'https://www.linkedin.com/company/acme';
      const client = await repo.create(owner, {
        name: 'Acme',
        linkedinUrl: url,
      });
      expect(client.linkedinUrl).toBe(url);
      await expect(
        repo.update(client.id, owner, {
          id: client.id,
          linkedinUrl: 'https://www.linkedin.com/in/jane',
        }),
      ).resolves.toMatchObject({
        linkedinUrl: 'https://www.linkedin.com/in/jane',
      });
      await expect(
        repo.update(client.id, owner, { id: client.id, linkedinUrl: '' }),
      ).resolves.toMatchObject({ linkedinUrl: '' });
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

    it('changes the contacted date', async () => {
      const c = await repo.create(owner, { name: 'C' });
      const when = new Date('2026-09-01T09:30:00.000Z');
      await expect(
        repo.update(c.id, owner, { id: c.id, contactedAt: when }),
      ).resolves.toMatchObject({ contactedAt: when });
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

  describe("references to other users' records", () => {
    let theirs: [string, number[]][];

    beforeEach(async () => {
      theirs = [
        ['tagIds', [(await seedTag(db.prisma8, stranger, 'theirs')).id]],
        ['occupationIds', [(await seedOccupation(db.prisma8, stranger)).id]],
      ];
    });

    it("create refuses another user's tags or occupations", async () => {
      for (const [field, value] of theirs) {
        await expect(
          repo.create(owner, { name: 'Intruder', [field]: value }),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      await expect(
        db.prisma8.orm.public.Client.where({ userId: owner }).all(),
      ).resolves.toEqual([]);
    });

    it('update refuses them and leaves the client as it was', async () => {
      const own = await seedClient(db.prisma8, owner);
      const before = await snapshot(own.id);
      for (const [field, value] of theirs) {
        await expect(
          repo.update(own.id, owner, { id: own.id, [field]: value }),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      await expect(snapshot(own.id)).resolves.toEqual(before);
    });
  });
});
