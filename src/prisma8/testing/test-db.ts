import { PrismaService } from '../../prisma.service';
import { Prisma8Service } from '../prisma8.service';
import { resetDb } from './reset-db';

interface TestDb {
  prisma7: PrismaService;
  prisma8: Prisma8Service;
}

/**
 * One Prisma 7 and one Prisma 8 client per test file, every table emptied
 * before each test. Repository suites build their implementation from these.
 */
export function useTestDb(): TestDb {
  const db = {} as TestDb;

  beforeAll(() => {
    db.prisma7 = new PrismaService();
    db.prisma8 = new Prisma8Service();
  });

  beforeEach(resetDb);

  afterAll(async () => {
    await db.prisma7.$disconnect();
    await db.prisma8.onModuleDestroy();
  });

  return db;
}
