import { Prisma8Service } from '../prisma8.service';
import { resetDb } from './reset-db';

interface TestDb {
  prisma8: Prisma8Service;
}

/**
 * One Prisma 8 client per test file, every table emptied
 * before each test. Repository suites build their implementation from these.
 */
export function useTestDb(): TestDb {
  const db = {} as TestDb;

  beforeAll(() => {
    db.prisma8 = new Prisma8Service();
  });

  beforeEach(resetDb);

  afterAll(async () => {
    await db.prisma8.onModuleDestroy();
  });

  return db;
}
