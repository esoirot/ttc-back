import { at, seedClient, seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { ClientStatusHistoryRepository } from './client-status-history.repository';
import { Prisma8ClientStatusHistoryRepository } from './prisma8-client-status-history.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma8',
    (): ClientStatusHistoryRepository =>
      new Prisma8ClientStatusHistoryRepository(db.prisma8),
  ],
])('ClientStatusHistoryRepository (%s)', (_impl, make) => {
  let repo: ClientStatusHistoryRepository;
  let owner: number;
  let stranger: number;
  let client: number;

  const history = (
    clientId: number,
    userId: number,
    type: string,
    minute = 0,
  ) =>
    db.prisma8.orm.public.ClientStatusHistory.create({
      clientId,
      userId,
      _type: type,
      createdAt: at(minute),
    });

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8, { name: 'Owner' })).id;
    stranger = (await seedUser(db.prisma8)).id;
    client = (await seedClient(db.prisma8, owner)).id;
  });

  describe('findByClientIds', () => {
    it('returns nothing for no ids', async () => {
      await expect(repo.findByClientIds([], owner)).resolves.toEqual([]);
    });

    it("returns the history of the user's clients, oldest first, with its author", async () => {
      const foreign = (await seedClient(db.prisma8, stranger)).id;
      const notRequested = (await seedClient(db.prisma8, owner)).id;
      await history(notRequested, owner, 'CREATED');
      await history(client, owner, 'CONTACTED', 2);
      await history(client, owner, 'CREATED', 1);
      await history(foreign, stranger, 'CREATED');

      const rows = await repo.findByClientIds([client, foreign], owner);

      expect(rows.map((r) => r.type)).toEqual(['CREATED', 'CONTACTED']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        clientId: client,
        userId: owner,
        type: 'CREATED',
        payload: null,
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        user: { id: owner, name: 'Owner' },
      });
    });
  });

  describe('log', () => {
    it('stores the payload as JSON text', async () => {
      const row = await repo.log({
        clientId: client,
        userId: owner,
        type: 'STATUS_CHANGED',
        payload: { to: 'CLIENT' },
      });
      expect(row).toMatchObject({
        clientId: client,
        userId: owner,
        type: 'STATUS_CHANGED',
      });
      expect(JSON.parse(row.payload!)).toEqual({ to: 'CLIENT' });
    });

    it('stores null when no payload is given', async () => {
      await expect(
        repo.log({ clientId: client, userId: owner, type: 'X' }),
      ).resolves.toMatchObject({ payload: null });
    });
  });

  describe('logMany', () => {
    it('inserts every entry and returns the count', async () => {
      const count = await repo.logMany([
        { clientId: client, userId: owner, type: 'A', payload: { n: 1 } },
        { clientId: client, userId: owner, type: 'B' },
      ]);
      expect(count).toBe(2);
      const rows = await repo.findByClientIds([client], owner);
      expect(rows.map((r) => [r.type, r.payload]).sort()).toEqual([
        ['A', '{"n":1}'],
        ['B', null],
      ]);
    });

    it('returns 0 for an empty list', async () => {
      await expect(repo.logMany([])).resolves.toBe(0);
    });
  });
});
