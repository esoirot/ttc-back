import { NotFoundException } from '@nestjs/common';
import { RateType } from '../../generated/prisma/client';
import { toNumeric } from '../../prisma8/numeric';
import { at, seedClient, seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { ClientRateRepository } from './client-rate.repository';
import { PrismaClientRateRepository } from './prisma-client-rate.repository';
import { Prisma8ClientRateRepository } from './prisma8-client-rate.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma7',
    (): ClientRateRepository => new PrismaClientRateRepository(db.prisma7),
  ],
  [
    'prisma8',
    (): ClientRateRepository => new Prisma8ClientRateRepository(db.prisma8),
  ],
])('ClientRateRepository (%s)', (_impl, make) => {
  let repo: ClientRateRepository;
  let owner: number;
  let stranger: number;
  let client: number;

  const rate = (clientId: number, userId: number, name: string, minute = 0) =>
    db.prisma8.orm.public.ClientRate.create({
      clientId,
      userId,
      _type: 'HOURLY',
      name,
      amount: toNumeric(42.5),
      createdAt: at(minute),
      updatedAt: at(minute),
    });

  // The owner's rate on another client, created first: a write or read
  // that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof rate>>;

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
    decoy = await rate(
      (await seedClient(db.prisma8, owner)).id,
      owner,
      'decoy',
    );
    client = (await seedClient(db.prisma8, owner)).id;
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.ClientRate.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findByClient', () => {
    it("returns the client's rates oldest first, amounts as numbers", async () => {
      await rate(client, owner, 'second', 2);
      await rate(client, owner, 'first', 1);

      const rows = await repo.findByClient(owner, client);

      expect(rows.map((r) => r.name)).toEqual(['first', 'second']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        clientId: client,
        userId: owner,
        type: 'HOURLY',
        name: 'first',
        amount: 42.5,
        currency: 'EUR',
        description: null,
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it("is scoped by the client's owner, not the rate's userId", async () => {
      await rate(client, stranger, 'written by someone else');
      await expect(repo.findByClient(owner, client)).resolves.toHaveLength(1);
      await expect(repo.findByClient(stranger, client)).resolves.toEqual([]);
    });
  });

  describe('findById', () => {
    it("returns the rate, NotFound for another user's client", async () => {
      const { id } = await rate(client, owner, 'r');
      await expect(repo.findById(id, owner)).resolves.toMatchObject({
        id,
        amount: 42.5,
      });
      await expect(repo.findById(id, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('stores the rate with 4-decimal precision', async () => {
      await expect(
        repo.create(owner, {
          clientId: client,
          type: RateType.PER_WORD,
          name: 'Words',
          amount: 0.12345,
          currency: 'USD',
          description: 'per word',
        }),
      ).resolves.toMatchObject({
        clientId: client,
        userId: owner,
        type: 'PER_WORD',
        name: 'Words',
        amount: 0.1235,
        currency: 'USD',
        description: 'per word',
      });
    });
  });

  describe('update', () => {
    it('changes only the given fields and moves updatedAt forward', async () => {
      const { id } = await rate(client, owner, 'old', 1);
      const updated = await repo.update(id, owner, {
        id,
        name: 'new',
        type: RateType.DAY,
      });
      expect(updated).toMatchObject({
        name: 'new',
        type: 'DAY',
        amount: 42.5,
        currency: 'EUR',
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
    });

    it('changes the amount', async () => {
      const { id } = await rate(client, owner, 'r');
      await expect(
        repo.update(id, owner, { id, amount: 50.25 }),
      ).resolves.toMatchObject({ amount: 50.25, name: 'r' });
    });

    it("throws NotFound for another user's client and leaves the rate", async () => {
      const { id } = await rate(client, owner, 'keep');
      await expect(
        repo.update(id, stranger, { id, name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.findById(id, owner)).resolves.toMatchObject({
        name: 'keep',
      });
    });
  });

  describe('delete', () => {
    it("deletes the rate, NotFound for another user's client", async () => {
      const mine = await rate(client, owner, 'gone');
      const kept = await rate(client, owner, 'kept');
      await expect(repo.delete(kept.id, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await repo.delete(mine.id, owner);
      await expect(repo.findByClient(owner, client)).resolves.toEqual([
        expect.objectContaining({ id: kept.id }),
      ]);
    });
  });
});
