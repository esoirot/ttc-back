import { NotFoundException } from '@nestjs/common';
import { at, seedOccupation, seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { ChargeType, OccupationType } from '../entities/occupation.entity';
import { OccupationsRepository } from './occupations.repository';
import { Prisma8OccupationsRepository } from './prisma8-occupations.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

const pairs = (o: {
  languagePairs: { fromLanguage: string; toLanguage: string }[];
}) => o.languagePairs.map((p) => `${p.fromLanguage}>${p.toLanguage}`).sort();
const fields = (o: { customFields: { key: string; value: string }[] }) =>
  o.customFields.map((f) => `${f.key}=${f.value}`).sort();

describe.each([
  [
    'prisma8',
    (): OccupationsRepository => new Prisma8OccupationsRepository(db.prisma8),
  ],
])('OccupationsRepository (%s)', (_impl, make) => {
  let repo: OccupationsRepository;
  let owner: number;
  let stranger: number;

  // A third user's occupation with a pair, a field and a charge, created
  // first: a write that loses its filter lands here.
  const decoySnapshot = async (id: number) => ({
    occupation: await db.prisma8.orm.public.Occupation.first({ id }),
    pairs: await db.prisma8.orm.public.LanguagePair.where({
      occupationId: id,
    }).all(),
    fields: await db.prisma8.orm.public.CustomField.where({
      occupationId: id,
    }).all(),
    charges: await db.prisma8.orm.public.Charge.where({
      occupationId: id,
    }).all(),
  });
  let decoy: { id: number; before: Awaited<ReturnType<typeof decoySnapshot>> };

  beforeEach(async () => {
    repo = make();
    const id = (
      await seedOccupation(db.prisma8, (await seedUser(db.prisma8)).id, 'decoy')
    ).id;
    await db.prisma8.orm.public.LanguagePair.create({
      occupationId: id,
      fromLanguage: 'en',
      toLanguage: 'de',
    });
    await db.prisma8.orm.public.CustomField.create({
      occupationId: id,
      key: 'k',
      value: 'v',
    });
    await db.prisma8.orm.public.Charge.create({
      occupationId: id,
      name: 'decoy',
      amount: 1,
      _type: 'FIXED',
    });
    decoy = { id, before: await decoySnapshot(id) };
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  afterEach(async () => {
    await expect(decoySnapshot(decoy.id)).resolves.toEqual(decoy.before);
  });

  describe('create', () => {
    it('defaults to CUSTOM and stores language pairs and custom fields', async () => {
      const occupation = await repo.create(owner, {
        name: 'Translator',
        companyName: 'ACME',
        legalForm: 'SASU',
        professionalEmail: 'pro@acme.io',
        professionalPhone: '+33 1',
        website: 'https://acme.io',
        timezone: 'Europe/Paris',
        languagePairs: [{ fromLanguage: 'en', toLanguage: 'fr' }],
        customFields: [{ key: 'siret', value: '123' }],
      });
      expect(occupation).toMatchObject({
        userId: owner,
        name: 'Translator',
        occupationType: 'CUSTOM',
        companyName: 'ACME',
        legalForm: 'SASU',
        professionalEmail: 'pro@acme.io',
        professionalPhone: '+33 1',
        website: 'https://acme.io',
        timezone: 'Europe/Paris',
        objectiveQ1: null,
        charges: [],
        translationRates: [],
      });
      expect(pairs(occupation)).toEqual(['en>fr']);
      expect(fields(occupation)).toEqual(['siret=123']);
    });

    it('keeps an explicit type', async () => {
      await expect(
        repo.create(owner, {
          name: 'T',
          occupationType: OccupationType.TRANSLATOR,
        }),
      ).resolves.toMatchObject({
        occupationType: 'TRANSLATOR',
        languagePairs: [],
        customFields: [],
      });
    });
  });

  describe('findAll / findById', () => {
    it("returns the user's occupations oldest first with their relations", async () => {
      await db.prisma8.orm.public.Occupation.create({
        userId: owner,
        name: 'second',
        createdAt: at(2),
        updatedAt: at(2),
      });
      const first = await db.prisma8.orm.public.Occupation.create({
        userId: owner,
        name: 'first',
        createdAt: at(1),
        updatedAt: at(1),
      });
      await seedOccupation(db.prisma8, stranger);
      await db.prisma8.orm.public.Charge.create({
        occupationId: first.id,
        name: 'rent',
        amount: 500,
        _type: 'FIXED',
      });

      const rows = await repo.findAll(owner);

      expect(rows.map((o) => o.name)).toEqual(['first', 'second']);
      expect(rows[0].charges).toEqual([
        {
          id: anyNumber,
          occupationId: first.id,
          name: 'rent',
          amount: 500,
          type: 'FIXED',
        },
      ]);
      await expect(repo.findById(first.id, owner)).resolves.toMatchObject({
        name: 'first',
      });
    });

    it("throws NotFound for someone else's occupation", async () => {
      const { id } = await seedOccupation(db.prisma8, stranger);
      await expect(repo.findById(id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('changes the given fields and moves updatedAt', async () => {
      const o = await repo.create(owner, { name: 'Old', companyName: 'Keep' });
      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.update(o.id, owner, {
        id: o.id,
        name: 'New',
        objectiveQ2: 5000,
        website: null,
      });
      expect(updated).toMatchObject({
        name: 'New',
        companyName: 'Keep',
        objectiveQ2: 5000,
        website: null,
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        o.updatedAt.getTime(),
      );
    });

    it('ignores a null name', async () => {
      const o = await repo.create(owner, { name: 'Keep' });
      await expect(
        repo.update(o.id, owner, { id: o.id, name: null }),
      ).resolves.toMatchObject({ name: 'Keep' });
    });

    it('replaces language pairs and custom fields when given, clears them with null or []', async () => {
      const o = await repo.create(owner, {
        name: 'T',
        languagePairs: [{ fromLanguage: 'en', toLanguage: 'fr' }],
        customFields: [{ key: 'a', value: '1' }],
      });

      const untouched = await repo.update(o.id, owner, {
        id: o.id,
        name: 'T2',
      });
      expect([pairs(untouched), fields(untouched)]).toEqual([
        ['en>fr'],
        ['a=1'],
      ]);

      const replaced = await repo.update(o.id, owner, {
        id: o.id,
        languagePairs: [
          { fromLanguage: 'de', toLanguage: 'fr' },
          { fromLanguage: 'es', toLanguage: 'fr' },
        ],
        customFields: [{ key: 'b', value: '2' }],
      });
      expect([pairs(replaced), fields(replaced)]).toEqual([
        ['de>fr', 'es>fr'],
        ['b=2'],
      ]);

      const cleared = await repo.update(o.id, owner, {
        id: o.id,
        languagePairs: null,
        customFields: [],
      });
      expect([cleared.languagePairs, cleared.customFields]).toEqual([[], []]);

      await repo.update(o.id, owner, {
        id: o.id,
        customFields: [{ key: 'c', value: '3' }],
      });
      const clearedFields = await repo.update(o.id, owner, {
        id: o.id,
        customFields: null,
      });
      expect(clearedFields.customFields).toEqual([]);
    });

    it("throws NotFound for someone else's occupation", async () => {
      const { id } = await seedOccupation(db.prisma8, stranger);
      await expect(
        repo.update(id, owner, { id, name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it("deletes the occupation, NotFound for someone else's", async () => {
      const mine = await seedOccupation(db.prisma8, owner);
      const theirs = await seedOccupation(db.prisma8, stranger);
      await expect(repo.delete(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await repo.delete(mine.id, owner);
      await expect(repo.findAll(owner)).resolves.toEqual([]);
    });
  });

  describe('charges', () => {
    it('creates a charge on an own occupation, NotFound on someone else', async () => {
      const mine = await seedOccupation(db.prisma8, owner);
      const theirs = await seedOccupation(db.prisma8, stranger);
      await expect(
        repo.createCharge(owner, {
          occupationId: mine.id,
          name: 'insurance',
          amount: 30,
          type: ChargeType.VARIABLE,
        }),
      ).resolves.toEqual({
        id: anyNumber,
        occupationId: mine.id,
        name: 'insurance',
        amount: 30,
        type: 'VARIABLE',
      });
      await expect(
        repo.createCharge(owner, {
          occupationId: theirs.id,
          name: 'x',
          amount: 1,
          type: ChargeType.FIXED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates the given non-null fields, NotFound on someone else', async () => {
      const mine = await seedOccupation(db.prisma8, owner);
      const charge = await repo.createCharge(owner, {
        occupationId: mine.id,
        name: 'rent',
        amount: 500,
        type: ChargeType.FIXED,
      });
      await expect(
        repo.updateCharge(charge.id, owner, {
          id: charge.id,
          amount: 550,
          name: null,
        }),
      ).resolves.toMatchObject({ name: 'rent', amount: 550, type: 'FIXED' });
      await expect(
        repo.updateCharge(charge.id, stranger, { id: charge.id, amount: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        repo.updateCharge(charge.id, owner, {
          id: charge.id,
          type: ChargeType.VARIABLE,
        }),
      ).resolves.toMatchObject({ type: 'VARIABLE', amount: 550 });
    });

    it("refuses someone else's charge even when the user has charges of their own", async () => {
      const mine = await seedOccupation(db.prisma8, owner);
      await repo.createCharge(owner, {
        occupationId: mine.id,
        name: 'own',
        amount: 1,
        type: ChargeType.FIXED,
      });
      const theirs = await seedOccupation(db.prisma8, stranger);
      const charge = await repo.createCharge(stranger, {
        occupationId: theirs.id,
        name: 'theirs',
        amount: 9,
        type: ChargeType.FIXED,
      });
      await expect(
        repo.updateCharge(charge.id, owner, { id: charge.id, amount: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.deleteCharge(charge.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.findById(theirs.id, stranger)).resolves.toMatchObject({
        charges: [expect.objectContaining({ name: 'theirs', amount: 9 })],
      });
    });

    it('deletes a charge, NotFound on someone else', async () => {
      const mine = await seedOccupation(db.prisma8, owner);
      const charge = await repo.createCharge(owner, {
        occupationId: mine.id,
        name: 'rent',
        amount: 500,
        type: ChargeType.FIXED,
      });
      await expect(
        repo.deleteCharge(charge.id, stranger),
      ).rejects.toBeInstanceOf(NotFoundException);
      await repo.deleteCharge(charge.id, owner);
      await expect(repo.findById(mine.id, owner)).resolves.toMatchObject({
        charges: [],
      });
    });
  });
});
