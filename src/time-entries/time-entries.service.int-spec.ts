import { ActivitiesService } from '../tasks/activities.service';
import { seedOccupation, seedProject } from '../prisma8/testing/seed';
import { seedTaskAccess } from '../prisma8/testing/task-access';
import { useTestDb } from '../prisma8/testing/test-db';
import { toDb } from '../prisma8/timestamp';
import { PrismaTimeEntryRepository } from './repositories/prisma-time-entry.repository';
import { Prisma8TimeEntryRepository } from './repositories/prisma8-time-entry.repository';
import { TimeEntriesService } from './time-entries.service';

const db = useTestDb();
const activities = {
  logForTimeEntry: jest.fn(),
} as unknown as ActivitiesService;

describe.each([
  [
    'prisma7',
    () =>
      new TimeEntriesService(
        new PrismaTimeEntryRepository(db.prisma7),
        activities,
      ),
  ],
  [
    'prisma8',
    () =>
      new TimeEntriesService(
        new Prisma8TimeEntryRepository(db.prisma8),
        activities,
      ),
  ],
])('TimeEntriesService database rules (%s)', (_impl, make) => {
  let service: TimeEntriesService;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;
  const span = {
    startTime: new Date('2026-10-07T08:00:00.000Z'),
    endTime: new Date('2026-10-07T09:00:00.000Z'),
  };

  const link = (projectId: number, occupationId: number) =>
    db.prisma8.orm.public.ProjectOccupation.create({ projectId, occupationId });

  beforeEach(async () => {
    service = make();
    s = await seedTaskAccess(db.prisma8);
  });

  it('fills the task from the subtask when only the subtask is given', async () => {
    const sub = await db.prisma8.orm.public.Subtask.create({
      taskId: s.task,
      title: 'x',
      updatedAt: toDb(new Date()),
    });
    await expect(
      service.create(s.owner, { ...span, subtaskId: sub.id }),
    ).resolves.toMatchObject({ taskId: s.task, subtaskId: sub.id });
    await expect(
      service.startTimer(s.owner, { subtaskId: sub.id }),
    ).resolves.toMatchObject({ taskId: s.task });
  });

  it("defaults the occupation to the project's lowest-id occupation", async () => {
    const first = await seedOccupation(db.prisma8, s.owner);
    const second = await seedOccupation(db.prisma8, s.owner);
    await link(s.project, second.id);
    await link(s.project, first.id);

    await expect(
      service.create(s.owner, { ...span, projectId: s.project }),
    ).resolves.toMatchObject({ occupationId: first.id });
  });

  it('keeps an explicit occupation, including null, and uses null without a project or link', async () => {
    const o = await seedOccupation(db.prisma8, s.owner);
    await link(s.project, o.id);
    const bare = await seedProject(db.prisma8, s.owner);

    await expect(
      service.create(s.owner, {
        ...span,
        projectId: s.project,
        occupationId: null,
      }),
    ).resolves.toMatchObject({ occupationId: null });
    await expect(
      service.create(s.owner, { ...span, projectId: bare.id }),
    ).resolves.toMatchObject({ occupationId: null });
    await expect(service.create(s.owner, span)).resolves.toMatchObject({
      occupationId: null,
    });
  });
});
