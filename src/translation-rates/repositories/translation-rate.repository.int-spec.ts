import { NotFoundException } from '@nestjs/common';
import {
  at,
  seedClient,
  seedOccupation,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { TranslationRateType } from '../entities/translation-rate.entity';
import { PrismaTranslationRateRepository } from './prisma-translation-rate.repository';
import { Prisma8TranslationRateRepository } from './prisma8-translation-rate.repository';
import { TranslationRateRepository } from './translation-rate.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma7',
    (): TranslationRateRepository =>
      new PrismaTranslationRateRepository(db.prisma7),
  ],
  [
    'prisma8',
    (): TranslationRateRepository =>
      new Prisma8TranslationRateRepository(db.prisma8),
  ],
])('TranslationRateRepository (%s)', (_impl, make) => {
  let repo: TranslationRateRepository;
  let owner: number;
  let stranger: number;

  const rate = (
    userId: number,
    name: string,
    data: {
      type?: 'HOURLY' | 'PER_WORD';
      occupationId?: number;
      minute?: number;
    } = {},
  ) =>
    db.prisma8.orm.public.TranslationRate.create({
      userId,
      name,
      _type: data.type ?? 'HOURLY',
      amount: 50,
      occupationId: data.occupationId ?? null,
      createdAt: at(data.minute ?? 0),
      updatedAt: at(data.minute ?? 0),
    });

  // A third user's rate, created first: a write or read that loses its
  // filter lands here.
  let decoy: Awaited<ReturnType<typeof rate>>;

  beforeEach(async () => {
    repo = make();
    decoy = await rate((await seedUser(db.prisma8)).id, 'decoy');
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.TranslationRate.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findAll', () => {
    it("returns the user's rates oldest first", async () => {
      await rate(owner, 'second', { minute: 2 });
      await rate(owner, 'first', { minute: 1 });
      await rate(stranger, 'not mine');

      const rows = await repo.findAll(owner);

      expect(rows.map((r) => r.name)).toEqual(['first', 'second']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        userId: owner,
        occupationId: null,
        clientId: null,
        type: 'HOURLY',
        name: 'first',
        amount: 50,
        currency: 'EUR',
        description: null,
        sourceLanguage: null,
        targetLanguage: null,
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it('filters by type and by occupation', async () => {
      const occupation = (await seedOccupation(db.prisma8, owner)).id;
      await rate(owner, 'hourly');
      await rate(owner, 'words', {
        type: 'PER_WORD',
        occupationId: occupation,
      });

      await expect(repo.findAll(owner, 'PER_WORD')).resolves.toEqual([
        expect.objectContaining({ name: 'words' }),
      ]);
      await expect(repo.findAll(owner, undefined, occupation)).resolves.toEqual(
        [expect.objectContaining({ name: 'words' })],
      );
    });
  });

  describe('findById', () => {
    it("returns the user's rate, NotFound for someone else's", async () => {
      const { id } = await rate(owner, 'mine');
      await expect(repo.findById(id, owner)).resolves.toMatchObject({
        id,
        name: 'mine',
      });
      await expect(repo.findById(id, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('stores every field, null for omitted links and languages', async () => {
      const client = (await seedClient(db.prisma8, owner)).id;
      await expect(
        repo.create(owner, {
          type: TranslationRateType.PER_WORD,
          clientId: client,
          name: 'EN-FR',
          amount: 0.12,
          currency: 'USD',
          description: 'words',
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        }),
      ).resolves.toMatchObject({
        userId: owner,
        occupationId: null,
        clientId: client,
        type: 'PER_WORD',
        amount: 0.12,
        currency: 'USD',
        description: 'words',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });
      await expect(
        repo.create(owner, {
          type: TranslationRateType.HOURLY,
          name: 'h',
          amount: 1,
          currency: 'EUR',
        }),
      ).resolves.toMatchObject({
        clientId: null,
        sourceLanguage: null,
        targetLanguage: null,
        description: null,
      });
    });
  });

  describe('update', () => {
    it('changes only the given fields, moves updatedAt', async () => {
      const occupation = (await seedOccupation(db.prisma8, owner)).id;
      const { id } = await rate(owner, 'old', { minute: 1 });

      const updated = await repo.update(id, owner, {
        id,
        name: 'new',
        amount: 75,
        occupationId: occupation,
      });

      expect(updated).toMatchObject({
        name: 'new',
        amount: 75,
        occupationId: occupation,
        type: 'HOURLY',
        currency: 'EUR',
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
    });

    it('changes the type', async () => {
      const { id } = await rate(owner, 'r');
      await expect(
        repo.update(id, owner, { id, type: TranslationRateType.PER_WORD }),
      ).resolves.toMatchObject({ type: 'PER_WORD', name: 'r' });
    });

    it('stores an occupation given on create', async () => {
      const occupation = (await seedOccupation(db.prisma8, owner)).id;
      await expect(
        repo.create(owner, {
          type: TranslationRateType.HOURLY,
          occupationId: occupation,
          name: 'h',
          amount: 1,
          currency: 'EUR',
        }),
      ).resolves.toMatchObject({ occupationId: occupation });
    });

    it("throws NotFound for someone else's rate", async () => {
      const { id } = await rate(stranger, 'theirs');
      await expect(
        repo.update(id, owner, { id, name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it("deletes the user's rate, NotFound for someone else's", async () => {
      const mine = await rate(owner, 'mine');
      const theirs = await rate(stranger, 'theirs');
      await expect(repo.delete(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await repo.delete(mine.id, owner);
      await expect(repo.findAll(owner)).resolves.toEqual([]);
      await expect(repo.findAll(stranger)).resolves.toHaveLength(1);
    });
  });
});
