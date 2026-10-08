import { NotFoundException } from '@nestjs/common';
import {
  seedClient,
  seedOccupation,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { CreateRateSheetInput } from '../dto/create-rate-sheet.input';
import { Prisma8RateSheetRepository } from './prisma8-rate-sheet.repository';
import { RateSheetRepository } from './rate-sheet.repository';
import { anyDate, anyNumber } from '../../prisma8/testing/matchers';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { toNumeric } from '../../prisma8/numeric';
import { nowDb } from '../../prisma8/timestamp';
import { toVarchar } from '../../prisma8/varchar';

const db = useTestDb();

const matchRates = {
  perfectMatch: 0,
  cm: 10,
  repetitions: 20,
  repetitionsBetweenFiles: 30,
  match100: 40,
  match95_99: 50,
  match85_94: 60,
  match75_84: 70,
  match50_74: 80,
  referenceAdaptativeMT: 90,
  adaptativeMTWithLearning: 95,
  newWordsTA: 100,
};

const input = (
  data: Partial<CreateRateSheetInput> = {},
): CreateRateSheetInput => ({
  name: 'Sheet',
  sourceLanguage: 'en',
  targetLanguage: 'fr',
  currency: 'EUR',
  pricePerWord: 0.123456,
  matchRates,
  ...data,
});

describe.each([
  [
    'prisma8',
    (): RateSheetRepository => new Prisma8RateSheetRepository(db.prisma8),
  ],
])('RateSheetRepository (%s)', (_impl, make) => {
  let repo: RateSheetRepository;
  let owner: number;
  let stranger: number;
  let client: number;

  const defaults = async () =>
    (await repo.findAll(owner)).filter((s) => s.isDefault).map((s) => s.name);

  // A third user's default sheet, created first: a write that loses its
  // filter (including clearing defaults) lands here.
  let decoy: Awaited<
    ReturnType<Prisma8Service['orm']['public']['RateSheet']['create']>
  >;

  beforeEach(async () => {
    repo = make();
    decoy = await db.prisma8.orm.public.RateSheet.create({
      userId: (await seedUser(db.prisma8)).id,
      name: 'decoy',
      sourceLanguage: toVarchar('en'),
      targetLanguage: toVarchar('fr'),
      currency: 'EUR',
      pricePerWord: toNumeric(0.1),
      matchRates,
      isDefault: true,
      updatedAt: nowDb(),
    });
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
    client = (await seedClient(db.prisma8, owner)).id;
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.RateSheet.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('create', () => {
    it('stores the sheet with exact price and match rates', async () => {
      await expect(
        repo.create(owner, input({ description: 'd' })),
      ).resolves.toEqual({
        id: anyNumber,
        userId: owner,
        occupationId: null,
        clientId: null,
        name: 'Sheet',
        description: 'd',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        currency: 'EUR',
        pricePerWord: 0.123456,
        matchRates,
        isDefault: false,
        createdAt: anyDate,
        updatedAt: anyDate,
      });
    });

    it("makes a client's first sheet its default", async () => {
      await repo.create(owner, input({ name: 'first', clientId: client }));
      await repo.create(owner, input({ name: 'second', clientId: client }));
      await expect(defaults()).resolves.toEqual(['first']);
    });

    it("makes a client's first sheet its default even when the user has other sheets", async () => {
      const other = (await seedClient(db.prisma8, owner)).id;
      await repo.create(owner, input({ name: 'no client' }));
      await repo.create(
        owner,
        input({ name: 'other client', clientId: other }),
      );
      await repo.create(owner, input({ name: 'first', clientId: client }));
      await expect(defaults()).resolves.toEqual(['other client', 'first']);
    });

    it('stores an occupation', async () => {
      const occupation = (await seedOccupation(db.prisma8, owner)).id;
      await expect(
        repo.create(owner, input({ occupationId: occupation })),
      ).resolves.toMatchObject({ occupationId: occupation });
    });

    it('moves the default when a new sheet is created as default', async () => {
      await repo.create(owner, input({ name: 'first', clientId: client }));
      await repo.create(
        owner,
        input({ name: 'second', clientId: client, isDefault: true }),
      );
      await expect(defaults()).resolves.toEqual(['second']);
    });
  });

  describe('findAll / findById', () => {
    it("returns the user's sheets oldest first, NotFound for someone else's", async () => {
      const first = await repo.create(owner, input({ name: 'first' }));
      await repo.create(owner, input({ name: 'second' }));
      const theirs = await repo.create(stranger, input({ name: 'theirs' }));

      await expect(repo.findAll(owner)).resolves.toEqual([
        expect.objectContaining({ name: 'first' }),
        expect.objectContaining({ name: 'second' }),
      ]);
      await expect(repo.findById(first.id, owner)).resolves.toMatchObject({
        name: 'first',
      });
      await expect(repo.findById(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('changes the given fields, replaces match rates, moves updatedAt', async () => {
      const sheet = await repo.create(owner, input());
      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.update(sheet.id, owner, {
        id: sheet.id,
        name: 'Renamed',
        pricePerWord: 0.2,
        matchRates: { ...matchRates, cm: 15 },
      });
      expect(updated).toMatchObject({
        name: 'Renamed',
        pricePerWord: 0.2,
        matchRates: { ...matchRates, cm: 15 },
        currency: 'EUR',
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        sheet.updatedAt.getTime(),
      );
    });

    it('changes the language pair', async () => {
      const sheet = await repo.create(owner, input());
      await expect(
        repo.update(sheet.id, owner, {
          id: sheet.id,
          sourceLanguage: 'de',
          targetLanguage: 'es',
        }),
      ).resolves.toMatchObject({ sourceLanguage: 'de', targetLanguage: 'es' });
    });

    it('setting isDefault clears the previous default of the same client', async () => {
      await repo.create(owner, input({ name: 'first', clientId: client }));
      const second = await repo.create(
        owner,
        input({ name: 'second', clientId: client }),
      );
      await repo.update(second.id, owner, { id: second.id, isDefault: true });
      await expect(defaults()).resolves.toEqual(['second']);
    });

    it('keeps the price and other defaults when they are not part of the update', async () => {
      const other = (await seedClient(db.prisma8, owner)).id;
      await repo.create(
        owner,
        input({ name: 'other client', clientId: other }),
      );
      const sheet = await repo.create(
        owner,
        input({ name: 'mine', clientId: client }),
      );
      await expect(
        repo.update(sheet.id, owner, { id: sheet.id, name: 'renamed' }),
      ).resolves.toMatchObject({ pricePerWord: 0.123456, isDefault: true });
      await expect(defaults()).resolves.toEqual(['other client', 'renamed']);
    });

    it("moving a sheet to another client as its default clears that client's default", async () => {
      const other = (await seedClient(db.prisma8, owner)).id;
      await repo.create(
        owner,
        input({ name: 'other default', clientId: other }),
      );
      const sheet = await repo.create(owner, input({ name: 'moved' }));
      await repo.update(sheet.id, owner, {
        id: sheet.id,
        clientId: other,
        isDefault: true,
      });
      await expect(defaults()).resolves.toEqual(['moved']);
    });

    it("throws NotFound for someone else's sheet", async () => {
      const theirs = await repo.create(stranger, input());
      await expect(
        repo.update(theirs.id, owner, { id: theirs.id, name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it("deletes the user's sheet, NotFound for someone else's", async () => {
      const mine = await repo.create(owner, input());
      const theirs = await repo.create(stranger, input());
      await expect(repo.delete(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await repo.delete(mine.id, owner);
      await expect(repo.findAll(owner)).resolves.toEqual([]);
    });
  });
});
