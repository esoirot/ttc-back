import { ConflictException, NotFoundException } from '@nestjs/common';
import { toDb } from '../../prisma8/timestamp';
import {
  seedOccupation,
  seedProject,
  seedTag,
  seedTask,
  seedTimeEntry,
  seedUser,
} from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { PrismaTimeEntryRepository } from './prisma-time-entry.repository';
import { TimeEntryRepository } from './time-entry.repository';
import { anyString } from '../../prisma8/testing/matchers';

const db = useTestDb();
const t = (iso: string) => new Date(iso);

describe.each([
  [
    'prisma7',
    (): TimeEntryRepository => new PrismaTimeEntryRepository(db.prisma7),
  ],
])('TimeEntryRepository (%s)', (_impl, make) => {
  let repo: TimeEntryRepository;
  let owner: number;
  let stranger: number;

  const entry = (
    userId: number,
    start: string,
    data: Parameters<typeof seedTimeEntry>[2] = {},
  ) =>
    seedTimeEntry(db.prisma8, userId, {
      startTime: toDb(t(start)),
      endTime: toDb(t(start)),
      durationSeconds: 0,
      ...data,
    });
  const ids = (page: { items: { id: number }[] }) =>
    page.items.map((e) => e.id);

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  describe('create / findById', () => {
    it('computes the duration, defaults billable, links tags, task, subtask and occupation', async () => {
      const s = await seedTaskAccess(db.prisma8);
      const tag = await seedTag(db.prisma8, s.owner, 'focus');
      const occupation = await seedOccupation(
        db.prisma8,
        s.owner,
        'Translator',
      );
      const subtask = await db.prisma8.orm.public.Subtask.create({
        taskId: s.task,
        title: 'Section A',
        checklistTitle: 'Sections',
        updatedAt: toDb(new Date()),
      });

      const created = await repo.create(s.owner, {
        projectId: s.project,
        taskId: s.task,
        subtaskId: subtask.id,
        description: 'Translating',
        startTime: t('2026-10-07T08:00:00.000Z'),
        endTime: t('2026-10-07T09:30:15.400Z'),
        occupationId: occupation.id,
        wordsProcessed: 1200,
        tagIds: [tag.id],
      });

      expect(created).toMatchObject({
        userId: s.owner,
        projectId: s.project,
        description: 'Translating',
        startTime: t('2026-10-07T08:00:00.000Z'),
        endTime: t('2026-10-07T09:30:15.400Z'),
        durationSeconds: 5415,
        billable: true,
        clockifyEntryId: null,
        wordsProcessed: 1200,
        invoicingStatus: 'NO',
        tags: [{ id: tag.id, name: 'focus' }],
        task: { id: s.task, title: anyString },
        subtask: {
          id: subtask.id,
          title: 'Section A',
          checklistTitle: 'Sections',
        },
      });
      expect(created.occupation).toMatchObject({
        id: occupation.id,
        name: 'Translator',
      });
      await expect(repo.findById(created.id, s.owner)).resolves.toMatchObject({
        durationSeconds: 5415,
      });
      await expect(
        repo.findById(created.id, s.stranger),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('has null links when none are given', async () => {
      const created = await repo.create(owner, {
        startTime: t('2026-10-07T08:00:00.000Z'),
        endTime: t('2026-10-07T08:00:01.000Z'),
        billable: false,
      });
      expect(created).toMatchObject({
        billable: false,
        tags: [],
        task: null,
        subtask: null,
        occupation: null,
        durationSeconds: 1,
      });
    });
  });

  describe('existsByClockifyEntryId', () => {
    it('is true only for the same user', async () => {
      await entry(owner, '2026-10-07T08:00:00.000Z', {
        clockifyEntryId: 'cf-1',
      });
      await expect(repo.existsByClockifyEntryId(owner, 'cf-1')).resolves.toBe(
        true,
      );
      await expect(
        repo.existsByClockifyEntryId(stranger, 'cf-1'),
      ).resolves.toBe(false);
    });
  });

  describe('findAll', () => {
    it("lists the user's entries newest first, pages with an id cursor", async () => {
      const oldest = await entry(owner, '2026-10-01T08:00:00.000Z');
      const newest = await entry(owner, '2026-10-03T08:00:00.000Z');
      const middle = await entry(owner, '2026-10-02T08:00:00.000Z');
      await entry(stranger, '2026-10-04T08:00:00.000Z');

      await expect(repo.findAll(owner, {}).then(ids)).resolves.toEqual([
        newest.id,
        middle.id,
        oldest.id,
      ]);
      const page1 = await repo.findAll(owner, {}, { limit: 1 });
      expect(page1).toMatchObject({ total: 3, nextCursor: newest.id });
      // Current behaviour: the cursor keeps ids greater than the last one, whatever their start time.
      await expect(
        repo.findAll(owner, {}, { cursor: oldest.id }).then(ids),
      ).resolves.toEqual([newest.id, middle.id]);
    });

    it('filters by date range, inclusive', async () => {
      await entry(owner, '2026-10-01T00:00:00.000Z');
      const inside = await entry(owner, '2026-10-02T12:00:00.000Z');
      const edge = await entry(owner, '2026-10-03T00:00:00.000Z');
      await entry(owner, '2026-10-03T00:00:00.001Z');
      const page = await repo.findAll(owner, {
        start: t('2026-10-02T00:00:00.000Z'),
        end: t('2026-10-03T00:00:00.000Z'),
      });
      expect(ids(page)).toEqual([edge.id, inside.id]);
    });

    it('filters by subtask, else task, else project list, else project', async () => {
      const s = await seedTaskAccess(db.prisma8);
      const p2 = await seedProject(db.prisma8, s.owner);
      const sub = await db.prisma8.orm.public.Subtask.create({
        taskId: s.task,
        title: 's',
        updatedAt: toDb(new Date()),
      });
      const onSub = await entry(s.owner, '2026-10-01T08:00:00.000Z', {
        projectId: s.project,
        taskId: s.task,
        subtaskId: sub.id,
      });
      const onTask = await entry(s.owner, '2026-10-02T08:00:00.000Z', {
        projectId: s.project,
        taskId: s.task,
      });
      const onP2 = await entry(s.owner, '2026-10-03T08:00:00.000Z', {
        projectId: p2.id,
      });

      await expect(
        repo.findAll(s.owner, { subtaskId: sub.id, taskId: 0 }).then(ids),
      ).resolves.toEqual([onSub.id]);
      await expect(
        repo.findAll(s.owner, { taskId: s.task, projectId: p2.id }).then(ids),
      ).resolves.toEqual([onTask.id, onSub.id]);
      await expect(
        repo
          .findAll(s.owner, { projectIds: [p2.id], projectId: s.project })
          .then(ids),
      ).resolves.toEqual([onP2.id]);
      await expect(
        repo
          .findAll(s.owner, { projectIds: [], projectId: s.project })
          .then(ids),
      ).resolves.toEqual([onTask.id, onSub.id]);
    });
  });

  describe('findFirstStartTime', () => {
    it("returns the user's earliest start, optionally per project, null when none", async () => {
      const p = await seedProject(db.prisma8, owner);
      await entry(owner, '2026-10-05T08:00:00.000Z', { projectId: p.id });
      await entry(owner, '2026-09-01T08:00:00.000Z');
      await expect(repo.findFirstStartTime(owner)).resolves.toEqual(
        t('2026-09-01T08:00:00.000Z'),
      );
      await expect(repo.findFirstStartTime(owner, p.id)).resolves.toEqual(
        t('2026-10-05T08:00:00.000Z'),
      );
      await expect(repo.findFirstStartTime(stranger)).resolves.toBeNull();
    });
  });

  describe('timer', () => {
    it('starts a running entry, refuses a second one, and stops it with its duration', async () => {
      await expect(repo.findActive(owner)).resolves.toBeNull();
      const started = await repo.startTimer(owner, {
        description: 'Working',
        billable: false,
      });
      expect(started).toMatchObject({
        endTime: null,
        durationSeconds: null,
        billable: false,
        description: 'Working',
      });
      await expect(repo.findActive(owner)).resolves.toMatchObject({
        id: started.id,
      });
      await expect(repo.startTimer(owner, {})).rejects.toBeInstanceOf(
        ConflictException,
      );

      const stopped = await repo.stopTimer(owner);
      expect(stopped.id).toBe(started.id);
      expect(stopped.endTime).toBeInstanceOf(Date);
      expect(stopped.durationSeconds).toBe(
        Math.round(
          (stopped.endTime!.getTime() - stopped.startTime.getTime()) / 1000,
        ),
      );
      await expect(repo.findActive(owner)).resolves.toBeNull();
    });

    it('throws NotFound when stopping without a running timer', async () => {
      await expect(repo.stopTimer(owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('resumes a stopped entry so its running time includes the previous duration', async () => {
      const done = await entry(owner, '2026-10-01T08:00:00.000Z', {
        durationSeconds: 600,
      });
      const before = Date.now();
      const resumed = await repo.resumeEntry(done.id, owner);
      expect(resumed).toMatchObject({
        id: done.id,
        endTime: null,
        durationSeconds: null,
      });
      const elapsed = Date.now() - resumed.startTime.getTime();
      expect(elapsed).toBeGreaterThanOrEqual(600_000 - 5);
      expect(elapsed).toBeLessThan(600_000 + (Date.now() - before) + 1000);
    });

    it('refuses to resume while another timer runs, or a foreign entry', async () => {
      const done = await entry(owner, '2026-10-01T08:00:00.000Z');
      const theirs = await entry(stranger, '2026-10-01T08:00:00.000Z');
      await expect(repo.resumeEntry(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await repo.startTimer(owner, {});
      await expect(repo.resumeEntry(done.id, owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('recomputes the duration from new or stored times and replaces tags when given', async () => {
      const t1 = await seedTag(db.prisma8, owner, 't1');
      const t2 = await seedTag(db.prisma8, owner, 't2');
      const e = await repo.create(owner, {
        startTime: t('2026-10-07T08:00:00.000Z'),
        endTime: t('2026-10-07T09:00:00.000Z'),
        tagIds: [t1.id],
      });

      const moved = await repo.update(e.id, owner, {
        id: e.id,
        endTime: t('2026-10-07T10:00:00.000Z'),
        description: 'longer',
      });
      expect(moved).toMatchObject({
        durationSeconds: 7200,
        description: 'longer',
        tags: [{ id: t1.id, name: 't1' }],
      });

      const retagged = await repo.update(e.id, owner, {
        id: e.id,
        tagIds: [t2.id],
        wordsProcessed: 300,
      });
      expect(retagged).toMatchObject({
        durationSeconds: 7200,
        wordsProcessed: 300,
        tags: [{ id: t2.id, name: 't2' }],
      });
    });

    it('keeps a running entry without duration and clears links with null', async () => {
      const s = await seedTaskAccess(db.prisma8);
      const running = await repo.startTimer(s.owner, {
        projectId: s.project,
        taskId: s.task,
      });
      await expect(
        repo.update(running.id, s.owner, {
          id: running.id,
          taskId: null,
          description: 'x',
        }),
      ).resolves.toMatchObject({
        durationSeconds: null,
        endTime: null,
        task: null,
      });
    });

    it("throws NotFound for someone else's entry", async () => {
      const theirs = await entry(stranger, '2026-10-01T08:00:00.000Z');
      await expect(
        repo.update(theirs.id, owner, { id: theirs.id, description: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it("deletes and returns the entry, NotFound for someone else's", async () => {
      const mine = await entry(owner, '2026-10-01T08:00:00.000Z');
      const theirs = await entry(stranger, '2026-10-01T08:00:00.000Z');
      await expect(repo.delete(theirs.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.delete(mine.id, owner)).resolves.toMatchObject({
        id: mine.id,
      });
      await expect(repo.findById(mine.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('sums', () => {
    it('sums every contributor per task, visible to owner and assignee', async () => {
      const s = await seedTaskAccess(db.prisma8);
      await entry(s.owner, '2026-10-01T08:00:00.000Z', {
        taskId: s.task,
        durationSeconds: 100,
        wordsProcessed: 10,
      });
      await entry(s.assignee, '2026-10-01T09:00:00.000Z', {
        taskId: s.task,
        durationSeconds: 50,
        wordsProcessed: 5,
      });
      await entry(s.owner, '2026-10-01T10:00:00.000Z', {
        taskId: s.otherTask,
        durationSeconds: 7,
      });

      await expect(
        repo.sumDurationByTaskIds([s.task, s.otherTask], s.assignee),
      ).resolves.toEqual(new Map([[s.task, 150]]));
      await expect(
        repo.sumDurationByTaskIds([s.task, s.otherTask], s.owner),
      ).resolves.toEqual(
        new Map([
          [s.task, 150],
          [s.otherTask, 7],
        ]),
      );
      await expect(
        repo.sumWordsProcessedByTaskIds([s.task, s.otherTask], s.owner),
      ).resolves.toEqual(
        new Map([
          [s.task, 15],
          [s.otherTask, 0],
        ]),
      );
      await expect(
        repo.sumDurationByTaskIds([s.task], s.stranger),
      ).resolves.toEqual(new Map());
    });

    it('sums every contributor per project, for the project owner only', async () => {
      const p = await seedProject(db.prisma8, owner);
      const other = await seedProject(db.prisma8, owner);
      await seedTask(db.prisma8, p.id);
      await entry(owner, '2026-10-01T08:00:00.000Z', {
        projectId: p.id,
        durationSeconds: 60,
        wordsProcessed: 100,
      });
      await entry(stranger, '2026-10-01T08:00:00.000Z', {
        projectId: p.id,
        durationSeconds: 40,
      });

      await expect(
        repo.sumDurationByProjectIds([p.id, other.id], owner),
      ).resolves.toEqual(new Map([[p.id, 100]]));
      await expect(
        repo.sumWordsProcessedByProjectIds([p.id], owner),
      ).resolves.toEqual(new Map([[p.id, 100]]));
      await expect(
        repo.sumDurationByProjectIds([p.id], stranger),
      ).resolves.toEqual(new Map());
    });
  });
});
