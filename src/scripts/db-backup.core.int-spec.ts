import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toNumeric } from '../prisma8/numeric';
import {
  seedClient,
  seedOccupation,
  seedProject,
  seedUser,
} from '../prisma8/testing/seed';
import { isoTimestamp } from '../prisma8/testing/matchers';
import { useTestDb } from '../prisma8/testing/test-db';
import { toDb } from '../prisma8/timestamp';
import { PrismaClientLike, runExport } from './db-backup.core';
import { importBackup8, prisma8BackupClient } from './db-backup.prisma8';
import { MODEL_ORDER } from './db-sync.util';

const db = useTestDb();

interface BackupPayload {
  models: string[];
  data: Record<string, Record<string, unknown>[]>;
}

describe.each([
  ['prisma7', () => db.prisma7 as unknown as PrismaClientLike],
  ['prisma8', () => prisma8BackupClient(db.prisma8)],
])('runExport (%s)', (_impl, client) => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ttc-export-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes every model in order, dates as ISO text and decimals as decimal text', async () => {
    const user = await seedUser(db.prisma8);
    const client_ = await seedClient(db.prisma8, user.id, {
      taxRate: toNumeric(20.5),
      contactedAt: toDb(new Date('2026-10-01T10:00:00.123Z')),
    });
    const occupation = await seedOccupation(db.prisma8, user.id);
    await db.prisma8.orm.public.ClientOccupation.create({
      clientId: client_.id,
      occupationId: occupation.id,
    });
    await seedProject(db.prisma8, user.id, { clientId: client_.id });

    const { file, counts } = await runExport(client(), dir);
    const payload = JSON.parse(readFileSync(file, 'utf-8')) as BackupPayload;

    expect(payload.models).toEqual([...MODEL_ORDER]);
    expect(Object.keys(payload.data)).toEqual([...MODEL_ORDER]);
    expect(counts).toMatchObject({
      User: 1,
      Client: 1,
      Occupation: 1,
      ClientOccupation: 1,
      Project: 1,
      Invoice: 0,
    });
    expect(payload.data.Client[0]).toMatchObject({
      id: client_.id,
      taxRate: '20.5',
      contactedAt: '2026-10-01T10:00:00.123Z',
      createdAt: isoTimestamp,
    });
    expect(payload.data.ClientOccupation[0]).toEqual({
      clientId: client_.id,
      occupationId: occupation.id,
    });
  });
});

describe('importBackup8', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ttc-import-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('restores an export exactly, including renamed columns, decimals and links', async () => {
    const user = await seedUser(db.prisma8);
    const client_ = await seedClient(db.prisma8, user.id, {
      taxRate: toNumeric(20.5),
      contactedAt: toDb(new Date('2026-10-01T10:00:00.123Z')),
    });
    const occupation = await seedOccupation(db.prisma8, user.id);
    await db.prisma8.orm.public.ClientOccupation.create({
      clientId: client_.id,
      occupationId: occupation.id,
    });
    await db.prisma8.orm.public.ClientRate.create({
      clientId: client_.id,
      userId: user.id,
      _type: 'HOURLY',
      name: 'r',
      amount: toNumeric(42.5),
      updatedAt: toDb(new Date()),
    });
    await seedProject(db.prisma8, user.id, { clientId: client_.id });

    const before = await runExport(prisma8BackupClient(db.prisma8), dir);
    const payload = JSON.parse(
      readFileSync(before.file, 'utf-8'),
    ) as BackupPayload;

    await importBackup8(db.prisma8, payload.data);
    const after = await runExport(prisma8BackupClient(db.prisma8), dir);

    expect(after.counts).toEqual(before.counts);
    expect(
      (JSON.parse(readFileSync(after.file, 'utf-8')) as BackupPayload).data,
    ).toEqual(payload.data);
  });
});
