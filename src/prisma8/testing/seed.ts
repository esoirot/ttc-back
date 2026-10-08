import { Prisma8Service } from '../prisma8.service';
import { toNumeric } from '../numeric';
import { toDb } from '../timestamp';
import { toVarchar } from '../varchar';

// Fixture rows written through Prisma 8, independent of the implementation
// under test. Required columns get defaults; `data` overrides any column.

type Orm = Prisma8Service['orm']['public'];
type UserInput = Parameters<Orm['User']['create']>[0];
type ClientInput = Parameters<Orm['Client']['create']>[0];
type ProjectInput = Parameters<Orm['Project']['create']>[0];
type TaskInput = Parameters<Orm['Task']['create']>[0];
type TimeEntryInput = Parameters<Orm['TimeEntry']['create']>[0];

let seq = 0;
const next = () => ++seq;
const now = () => toDb(new Date());

/** Distinct, ordered timestamps for tests that assert createdAt ordering. */
export const at = (minute: number) =>
  toDb(new Date(Date.UTC(2026, 0, 1, 0, minute)));

export function seedUser(db: Prisma8Service, data: Partial<UserInput> = {}) {
  return db.orm.public.User.create({
    email: `user${next()}@test.io`,
    updatedAt: now(),
    ...data,
  });
}

export function seedTag(db: Prisma8Service, userId: number, name: string) {
  return db.orm.public.Tag.create({ userId, name });
}

export function seedClient(
  db: Prisma8Service,
  userId: number,
  data: Partial<ClientInput> = {},
) {
  return db.orm.public.Client.create({
    userId,
    name: `Client ${next()}`,
    updatedAt: now(),
    ...data,
  });
}

export function seedProject(
  db: Prisma8Service,
  userId: number,
  data: Partial<ProjectInput> = {},
) {
  return db.orm.public.Project.create({
    userId,
    title: `Project ${next()}`,
    updatedAt: now(),
    ...data,
  });
}

export function seedTask(
  db: Prisma8Service,
  projectId: number,
  data: Partial<TaskInput> = {},
) {
  return db.orm.public.Task.create({
    projectId,
    title: `Task ${next()}`,
    updatedAt: now(),
    ...data,
  });
}

export function seedTimeEntry(
  db: Prisma8Service,
  userId: number,
  data: Partial<TimeEntryInput> = {},
) {
  return db.orm.public.TimeEntry.create({
    userId,
    startTime: now(),
    updatedAt: now(),
    ...data,
  });
}

export function seedOccupation(
  db: Prisma8Service,
  userId: number,
  name = `Occupation ${next()}`,
) {
  return db.orm.public.Occupation.create({ userId, name, updatedAt: now() });
}

export function seedRateSheet(
  db: Prisma8Service,
  userId: number,
  data: Partial<Parameters<Orm['RateSheet']['create']>[0]> = {},
) {
  return db.orm.public.RateSheet.create({
    userId,
    name: `Sheet ${next()}`,
    sourceLanguage: toVarchar('en'),
    targetLanguage: toVarchar('fr'),
    pricePerWord: toNumeric(0.1),
    matchRates: {},
    updatedAt: now(),
    ...data,
  });
}
