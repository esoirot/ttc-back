import { at, seedTimeEntry, seedUser } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { Prisma8TaskActivityRepository } from './prisma8-task-activity.repository';
import { TaskActivityRepository } from './task-activity.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma8',
    (): TaskActivityRepository => new Prisma8TaskActivityRepository(db.prisma8),
  ],
])('TaskActivityRepository (%s)', (_impl, make) => {
  let repo: TaskActivityRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const activity = (
    data: {
      taskId?: number;
      timeEntryId?: number;
      userId: number;
      type: string;
    },
    minute = 0,
  ) =>
    db.prisma8.orm.public.TaskActivity.create({
      taskId: data.taskId,
      timeEntryId: data.timeEntryId,
      userId: data.userId,
      _type: data.type,
      createdAt: at(minute),
    });

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
    await db.prisma8.orm.public.User.where({ id: s.owner }).update({
      name: 'Owner',
    });
  });

  describe('findByTaskIds', () => {
    it('returns nothing for no ids', async () => {
      await expect(repo.findByTaskIds([], s.owner)).resolves.toEqual([]);
    });

    it('returns the activity of the requested tasks, oldest first, with its author', async () => {
      await activity({ taskId: s.task, userId: s.owner, type: 'UPDATED' }, 2);
      await activity({ taskId: s.task, userId: s.owner, type: 'CREATED' }, 1);
      await activity(
        { taskId: s.otherTask, userId: s.owner, type: 'CREATED' },
        0,
      );

      const rows = await repo.findByTaskIds([s.task], s.owner);

      expect(rows.map((r) => r.type)).toEqual(['CREATED', 'UPDATED']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        taskId: s.task,
        timeEntryId: null,
        userId: s.owner,
        type: 'CREATED',
        payload: null,
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        user: { id: s.owner, name: 'Owner' },
      });
    });

    it('is visible to the assignee but not to a stranger', async () => {
      await activity({ taskId: s.task, userId: s.owner, type: 'CREATED' });
      await expect(
        repo.findByTaskIds([s.task], s.assignee),
      ).resolves.toHaveLength(1);
      await expect(repo.findByTaskIds([s.task], s.stranger)).resolves.toEqual(
        [],
      );
    });
  });

  describe('findByTimeEntryIds', () => {
    it('returns nothing for no ids', async () => {
      await expect(repo.findByTimeEntryIds([], s.owner)).resolves.toEqual([]);
    });

    it("returns only activity of the user's own time entries, oldest first", async () => {
      const mine = await seedTimeEntry(db.prisma8, s.owner);
      const theirs = await seedTimeEntry(db.prisma8, s.stranger);
      const notRequested = await seedTimeEntry(db.prisma8, s.owner);
      await activity({
        timeEntryId: notRequested.id,
        userId: s.owner,
        type: 'STARTED',
      });
      await activity(
        { timeEntryId: mine.id, userId: s.owner, type: 'STOPPED' },
        2,
      );
      await activity(
        { timeEntryId: mine.id, userId: s.owner, type: 'STARTED' },
        1,
      );
      await activity({
        timeEntryId: theirs.id,
        userId: s.stranger,
        type: 'STARTED',
      });

      const rows = await repo.findByTimeEntryIds([mine.id, theirs.id], s.owner);

      expect(rows.map((r) => [r.timeEntryId, r.type])).toEqual([
        [mine.id, 'STARTED'],
        [mine.id, 'STOPPED'],
      ]);
      expect(rows[0].user).toEqual({ id: s.owner, name: 'Owner' });
    });
  });

  describe('log', () => {
    it('stores the payload as JSON text', async () => {
      const row = await repo.log({
        taskId: s.task,
        userId: s.owner,
        type: 'STATUS_CHANGED',
        payload: { from: 'TODO', to: 'DONE' },
      });
      expect(row).toMatchObject({
        taskId: s.task,
        timeEntryId: null,
        userId: s.owner,
        type: 'STATUS_CHANGED',
      });
      expect(JSON.parse(row.payload!)).toEqual({ from: 'TODO', to: 'DONE' });
    });

    it('links the time entry when given', async () => {
      const e = await seedTimeEntry(db.prisma8, s.owner);
      await expect(
        repo.log({ timeEntryId: e.id, userId: s.owner, type: 'STARTED' }),
      ).resolves.toMatchObject({
        taskId: null,
        timeEntryId: e.id,
      });
    });

    it('stores a null payload and null links when omitted', async () => {
      const user = await seedUser(db.prisma8);
      await expect(
        repo.log({ userId: user.id, type: 'NOTE' }),
      ).resolves.toMatchObject({
        taskId: null,
        timeEntryId: null,
        payload: null,
      });
    });
  });
});
