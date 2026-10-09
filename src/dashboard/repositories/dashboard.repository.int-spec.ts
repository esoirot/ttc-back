import { toNumeric } from '../../prisma8/numeric';
import { toDb } from '../../prisma8/timestamp';
import {
  seedClient,
  seedProject,
  seedTask,
  seedTimeEntry,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { DashboardRepository } from './dashboard.repository';
import { Prisma8DashboardRepository } from './prisma8-dashboard.repository';

const db = useTestDb();

// Mid-month and mid-year, so local-time month/year starts are unambiguous.
const NOW = new Date('2026-10-15T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * day);
const ahead = (days: number) => new Date(NOW.getTime() + days * day);

describe.each([
  [
    'prisma8',
    (): DashboardRepository => new Prisma8DashboardRepository(db.prisma8),
  ],
])('DashboardRepository (%s)', (_impl, make) => {
  let repo: DashboardRepository;
  let owner: number;
  let stranger: number;

  beforeAll(() => {
    // Freeze Date only; real timers keep the database driver working.
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'hrtime',
        'performance',
      ],
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  it('is all zeros and empty lists for a new user', async () => {
    await expect(repo.getDashboard(owner)).resolves.toEqual({
      activeProjectCount: 0,
      unpaidInvoiceCount: 0,
      monthToDateSeconds: 0,
      monthToDateRevenue: 0,
      yearToDateWords: 0,
      upcomingDeadlines: [],
      recentTimeEntries: [],
      prospectsToContact: [],
    });
  });

  it('counts active projects and sent/overdue invoices of the user only', async () => {
    await seedProject(db.prisma8, owner, { status: 'ACTIVE' });
    await seedProject(db.prisma8, owner, { status: 'DRAFT' });
    await seedProject(db.prisma8, stranger, { status: 'ACTIVE' });
    for (const [n, status] of [
      ['1', 'SENT'],
      ['2', 'OVERDUE'],
      ['3', 'PAID'],
      ['4', 'DRAFT'],
    ] as const) {
      await db.prisma8.orm.public.Invoice.create({
        userId: owner,
        number: `I-${n}`,
        status,
        updatedAt: toDb(NOW),
      });
    }

    await expect(repo.getDashboard(owner)).resolves.toMatchObject({
      activeProjectCount: 1,
      unpaidInvoiceCount: 2,
    });
  });

  it('sums month-to-date time and revenue, and year-to-date words', async () => {
    await seedTimeEntry(db.prisma8, owner, {
      startTime: toDb(ago(3)),
      durationSeconds: 3600,
      wordsProcessed: 500,
    });
    await seedTimeEntry(db.prisma8, owner, {
      startTime: toDb(ago(1)),
      durationSeconds: 1800,
    });
    await seedTimeEntry(db.prisma8, owner, { startTime: toDb(ago(1)) });
    await seedTimeEntry(db.prisma8, owner, {
      startTime: toDb(ago(60)),
      durationSeconds: 9999,
      wordsProcessed: 250,
    });
    await seedTimeEntry(db.prisma8, owner, {
      startTime: toDb(ago(400)),
      wordsProcessed: 7777,
    });
    await seedTimeEntry(db.prisma8, stranger, {
      startTime: toDb(ago(1)),
      durationSeconds: 5,
      wordsProcessed: 5,
    });

    const thisMonth = await db.prisma8.orm.public.Invoice.create({
      userId: owner,
      number: 'I-1',
      issuedAt: toDb(ago(2)),
      updatedAt: toDb(NOW),
    });
    const lastQuarter = await db.prisma8.orm.public.Invoice.create({
      userId: owner,
      number: 'I-2',
      issuedAt: toDb(ago(60)),
      updatedAt: toDb(NOW),
    });
    const line = (invoiceId: number, total: number) =>
      db.prisma8.orm.public.InvoiceItem.create({
        invoiceId,
        description: 'x',
        quantity: toNumeric(1),
        unitPrice: toNumeric(total),
        total: toNumeric(total),
      });
    await line(thisMonth.id, 120.25);
    await line(thisMonth.id, 79.75);
    await line(lastQuarter.id, 1000);

    await expect(repo.getDashboard(owner)).resolves.toMatchObject({
      monthToDateSeconds: 5400,
      monthToDateRevenue: 200,
      yearToDateWords: 750,
    });
  });

  describe('upcoming deadlines', () => {
    const subtask = (
      taskId: number,
      title: string,
      data: { dueDate?: Date; done?: boolean } = {},
    ) =>
      db.prisma8.orm.public.Subtask.create({
        taskId,
        title,
        dueDate: data.dueDate && toDb(data.dueDate),
        done: data.done ?? false,
        updatedAt: toDb(NOW),
      });

    it('lists overdue and next-30-days projects, tasks and checklist items, earliest first', async () => {
      const late = await seedProject(db.prisma8, owner, {
        title: 'Late project',
        status: 'ACTIVE',
        deadline: toDb(ago(3)),
      });
      const book = await seedProject(db.prisma8, owner, { title: 'Book' });
      const task = await seedTask(db.prisma8, book.id, {
        title: 'Chapter 1',
        dueDate: toDb(ahead(2)),
      });
      const item = await subtask(task.id, 'Proofread', {
        dueDate: ahead(10),
      });
      // Beyond the 30-day horizon, or without a due date.
      await seedProject(db.prisma8, owner, { deadline: toDb(ahead(31)) });
      await seedTask(db.prisma8, book.id, { dueDate: toDb(ahead(31)) });
      await seedTask(db.prisma8, book.id);
      await subtask(task.id, 'No date');

      const { upcomingDeadlines } = await repo.getDashboard(owner);

      expect(upcomingDeadlines).toEqual([
        {
          kind: 'PROJECT',
          id: late.id,
          title: 'Late project',
          deadline: ago(3).toISOString(),
          projectId: late.id,
          projectTitle: 'Late project',
          taskId: null,
          taskTitle: null,
        },
        {
          kind: 'TASK',
          id: task.id,
          title: 'Chapter 1',
          deadline: ahead(2).toISOString(),
          projectId: book.id,
          projectTitle: 'Book',
          taskId: task.id,
          taskTitle: 'Chapter 1',
        },
        {
          kind: 'CHECKLIST_ITEM',
          id: item.id,
          title: 'Proofread',
          deadline: ahead(10).toISOString(),
          projectId: book.id,
          projectTitle: 'Book',
          taskId: task.id,
          taskTitle: 'Chapter 1',
        },
      ]);
    });

    it('merges the three kinds by due date, not by kind', async () => {
      const project = await seedProject(db.prisma8, owner, {
        title: 'P',
        deadline: toDb(ahead(5)),
      });
      const task = await seedTask(db.prisma8, project.id, {
        title: 'T',
        dueDate: toDb(ahead(3)),
      });
      await subtask(task.id, 'S', { dueDate: ahead(1) });

      const { upcomingDeadlines } = await repo.getDashboard(owner);

      expect(upcomingDeadlines.map((d) => d.title)).toEqual(['S', 'T', 'P']);
    });

    it('leaves out finished work, however late', async () => {
      for (const status of [
        'COMPLETED',
        'CANCELLED',
        'ARCHIVED',
        'INVOICE_SENT',
        'INVOICE_PAID',
      ] as const)
        await seedProject(db.prisma8, owner, {
          status,
          deadline: toDb(ago(1)),
        });
      const project = await seedProject(db.prisma8, owner);
      for (const status of ['DONE', 'PAID'] as const)
        await seedTask(db.prisma8, project.id, {
          status,
          dueDate: toDb(ago(1)),
        });
      const task = await seedTask(db.prisma8, project.id);
      await subtask(task.id, 'Ticked', { dueDate: ago(1), done: true });

      await expect(repo.getDashboard(owner)).resolves.toMatchObject({
        upcomingDeadlines: [],
      });
    });

    it('keeps the 20 earliest across every kind', async () => {
      const project = await seedProject(db.prisma8, owner);
      for (let d = 1; d <= 12; d++)
        await seedTask(db.prisma8, project.id, {
          title: `T${d}`,
          dueDate: toDb(ago(30 - d)),
        });
      const task = await seedTask(db.prisma8, project.id, { title: 'Holder' });
      for (let d = 1; d <= 12; d++)
        await subtask(task.id, `S${d}`, { dueDate: ahead(d) });

      const { upcomingDeadlines } = await repo.getDashboard(owner);

      expect(upcomingDeadlines.map((d) => d.title)).toEqual([
        ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
        ...Array.from({ length: 8 }, (_, i) => `S${i + 1}`),
      ]);
    });
  });

  it('shows the 5 most recent time entries, start time as ISO text', async () => {
    const entries = [];
    for (let i = 6; i >= 1; i--)
      entries.push(
        await seedTimeEntry(db.prisma8, owner, {
          startTime: toDb(ago(i)),
          description: `e${i}`,
          durationSeconds: i,
        }),
      );

    const { recentTimeEntries } = await repo.getDashboard(owner);

    expect(recentTimeEntries.map((e) => e.description)).toEqual([
      'e1',
      'e2',
      'e3',
      'e4',
      'e5',
    ]);
    expect(recentTimeEntries[0]).toEqual({
      id: entries[5].id,
      description: 'e1',
      startTime: ago(1).toISOString(),
      durationSeconds: 1,
    });
  });

  it("ignores every other user's data", async () => {
    await seedProject(db.prisma8, stranger, {
      status: 'ACTIVE',
      deadline: toDb(ahead(1)),
    });
    const inv = await db.prisma8.orm.public.Invoice.create({
      userId: stranger,
      number: 'S-1',
      status: 'SENT',
      issuedAt: toDb(ago(1)),
      updatedAt: toDb(NOW),
    });
    await db.prisma8.orm.public.InvoiceItem.create({
      invoiceId: inv.id,
      description: 'x',
      quantity: toNumeric(1),
      unitPrice: toNumeric(10),
      total: toNumeric(10),
    });
    await seedTimeEntry(db.prisma8, stranger, {
      startTime: toDb(ago(1)),
      durationSeconds: 60,
      wordsProcessed: 5,
    });
    await seedClient(db.prisma8, stranger, { status: 'TO_CONTACT' });
    const theirTask = await seedTask(
      db.prisma8,
      (await seedProject(db.prisma8, stranger)).id,
      { dueDate: toDb(ahead(1)) },
    );
    await db.prisma8.orm.public.Subtask.create({
      taskId: theirTask.id,
      title: 'Theirs',
      dueDate: toDb(ahead(1)),
      updatedAt: toDb(NOW),
    });

    await expect(repo.getDashboard(owner)).resolves.toEqual({
      activeProjectCount: 0,
      unpaidInvoiceCount: 0,
      monthToDateSeconds: 0,
      monthToDateRevenue: 0,
      yearToDateWords: 0,
      upcomingDeadlines: [],
      recentTimeEntries: [],
      prospectsToContact: [],
    });
  });

  it('lists prospects due for contact, longest-waiting first', async () => {
    const neverContacted = await seedClient(db.prisma8, owner, {
      name: 'New lead',
      status: 'TO_CONTACT',
    });
    const waiting = await seedClient(db.prisma8, owner, {
      name: 'Waiting',
      status: 'FOLLOW_UP_1',
      contactedAt: toDb(ago(90)),
    });
    const lessWaiting = await seedClient(db.prisma8, owner, {
      name: 'Less waiting',
      status: 'FOLLOW_UP_2',
      contactedAt: toDb(ago(30)),
    });
    await seedClient(db.prisma8, owner, {
      name: 'Just contacted',
      status: 'FOLLOW_UP_1',
      contactedAt: toDb(ago(0)),
    });
    await seedClient(db.prisma8, owner, { name: 'Customer', status: 'CLIENT' });
    await seedClient(db.prisma8, stranger, { status: 'TO_CONTACT' });

    const { prospectsToContact } = await repo.getDashboard(owner);

    expect(prospectsToContact).toEqual([
      {
        id: neverContacted.id,
        name: 'New lead',
        status: 'TO_CONTACT',
        contactedAt: null,
      },
      {
        id: waiting.id,
        name: 'Waiting',
        status: 'FOLLOW_UP_1',
        contactedAt: ago(90).toISOString(),
      },
      {
        id: lessWaiting.id,
        name: 'Less waiting',
        status: 'FOLLOW_UP_2',
        contactedAt: ago(30).toISOString(),
      },
    ]);
  });

  it('lists former clients, and counts waits from the newest of contact and recontact dates', async () => {
    const former = await seedClient(db.prisma8, owner, {
      name: 'Former',
      status: 'FORMER_CLIENT',
      contactedAt: toDb(ago(1)),
    });
    const recontactOnly = await seedClient(db.prisma8, owner, {
      name: 'Recontact only',
      status: 'RECONTACT_LATER',
      toRecontactAt: toDb(ago(200)),
    });
    const contactNewer = await seedClient(db.prisma8, owner, {
      name: 'Contact newer',
      status: 'CONTACTED',
      contactedAt: toDb(ago(20)),
      toRecontactAt: toDb(ago(60)),
    });
    const undatedFormer = await seedClient(db.prisma8, owner, {
      name: 'Undated former',
      status: 'FORMER_CLIENT',
    });
    const undatedLead = await seedClient(db.prisma8, owner, {
      name: 'Undated lead',
      status: 'TO_CONTACT',
    });
    await seedClient(db.prisma8, owner, {
      name: 'Recontact newer',
      status: 'FOLLOW_UP_1',
      contactedAt: toDb(ago(90)),
      toRecontactAt: toDb(ago(5)),
    });

    const { prospectsToContact } = await repo.getDashboard(owner);

    expect(prospectsToContact.map((p) => p.id)).toEqual([
      undatedFormer.id,
      undatedLead.id,
      recontactOnly.id,
      contactNewer.id,
      former.id,
    ]);
  });
});
