import { toNumeric } from '../../prisma8/numeric';
import { toDb } from '../../prisma8/timestamp';
import {
  seedClient,
  seedProject,
  seedTimeEntry,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { DashboardRepository } from './dashboard.repository';
import { PrismaDashboardRepository } from './prisma-dashboard.repository';

const db = useTestDb();

// Mid-month and mid-year, so local-time month/year starts are unambiguous.
const NOW = new Date('2026-10-15T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * day);
const ahead = (days: number) => new Date(NOW.getTime() + days * day);

describe.each([
  [
    'prisma7',
    (): DashboardRepository => new PrismaDashboardRepository(db.prisma7),
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

  it('lists open projects due within a week, soonest first, deadline as ISO text', async () => {
    const soon = await seedProject(db.prisma8, owner, {
      title: 'Soon',
      deadline: toDb(ahead(2)),
      status: 'ACTIVE',
    });
    const sooner = await seedProject(db.prisma8, owner, {
      title: 'Sooner',
      deadline: toDb(ahead(1)),
    });
    await seedProject(db.prisma8, owner, { deadline: toDb(ahead(8)) });
    await seedProject(db.prisma8, owner, { deadline: toDb(ago(1)) });
    await seedProject(db.prisma8, owner, {
      deadline: toDb(ahead(1)),
      status: 'COMPLETED',
    });

    const { upcomingDeadlines } = await repo.getDashboard(owner);

    expect(upcomingDeadlines).toEqual([
      {
        id: sooner.id,
        title: 'Sooner',
        deadline: ahead(1).toISOString(),
        status: 'DRAFT',
      },
      {
        id: soon.id,
        title: 'Soon',
        deadline: ahead(2).toISOString(),
        status: 'ACTIVE',
      },
    ]);
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
    ]);
  });
});
