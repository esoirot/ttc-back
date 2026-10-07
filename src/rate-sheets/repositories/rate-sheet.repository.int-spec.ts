import { NotFoundException } from '@nestjs/common';
import { seedClient, seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { CreateRateSheetInput } from '../dto/create-rate-sheet.input';
import { PrismaRateSheetRepository } from './prisma-rate-sheet.repository';
import { RateSheetRepository } from './rate-sheet.repository';

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
    'prisma7',
    (): RateSheetRepository => new PrismaRateSheetRepository(db.prisma7),
  ],
])('RateSheetRepository (%s)', (_impl, make) => {
  let repo: RateSheetRepository;
  let owner: number;
  let stranger: number;
  let client: number;

  const defaults = async () =>
    (await repo.findAll(owner)).filter((s) => s.isDefault).map((s) => s.name);

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
    client = (await seedClient(db.prisma8, owner)).id;
  });

  describe('create', () => {
    it('stores the sheet with exact price and match rates', async () => {
      await expect(
        repo.create(owner, input({ description: 'd' })),
      ).resolves.toEqual({
        id: expect.any(Number),
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
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it("makes a client's first sheet its default", async () => {
      await repo.create(owner, input({ name: 'first', clientId: client }));
      await repo.create(owner, input({ name: 'second', clientId: client }));
      await expect(defaults()).resolves.toEqual(['first']);
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

    it('setting isDefault clears the previous default of the same client', async () => {
      await repo.create(owner, input({ name: 'first', clientId: client }));
      const second = await repo.create(
        owner,
        input({ name: 'second', clientId: client }),
      );
      await repo.update(second.id, owner, { id: second.id, isDefault: true });
      await expect(defaults()).resolves.toEqual(['second']);
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
