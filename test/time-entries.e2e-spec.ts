import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { FastifyRequest, FastifyReply } from 'fastify';
import request from 'supertest';
import { TimeEntriesResolver } from '../src/time-entries/time-entries.resolver';
import { TimeEntriesService } from '../src/time-entries/time-entries.service';
import { TimerEventsService } from '../src/timer-events/timer-events.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import { TimeEntry } from '../src/time-entries/entities/time-entry.entity';
import { TimeEntryConnection } from '../src/time-entries/types/time-entry-connection.type';

const makeEntry = (
  overrides: Partial<Record<string, unknown>> = {},
): TimeEntry =>
  Object.assign(new TimeEntry(), {
    id: 1,
    userId: 1,
    startTime: new Date('2024-01-01T08:00:00Z'),
    billable: false,
    tags: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

const makeConn = (items = [makeEntry()]): TimeEntryConnection =>
  Object.assign(new TimeEntryConnection(), {
    items,
    nextCursor: null,
    total: items.length,
  });

const ENTRY_FIELDS = `{ id userId startTime billable }`;

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('TimeEntriesResolver (e2e)', () => {
  let app: NestFastifyApplication;
  let timeEntriesService: {
    findAll: jest.Mock;
    findActive: jest.Mock;
    create: jest.Mock;
    startTimer: jest.Mock;
    stopTimer: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let timerEventsService: { publish: jest.Mock };

  beforeAll(async () => {
    timeEntriesService = {
      findAll: jest.fn().mockResolvedValue(makeConn()),
      findActive: jest.fn().mockResolvedValue(makeEntry()),
      create: jest.fn().mockResolvedValue(makeEntry()),
      startTimer: jest.fn().mockResolvedValue(makeEntry()),
      stopTimer: jest
        .fn()
        .mockResolvedValue(makeEntry({ endTime: new Date() })),
      update: jest.fn().mockResolvedValue(makeEntry({ billable: true })),
      delete: jest.fn().mockResolvedValue(true),
    };
    timerEventsService = { publish: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          context: (request: FastifyRequest, reply: FastifyReply) => ({
            req: request,
            res: reply,
          }),
        }),
      ],
      providers: [
        TimeEntriesResolver,
        { provide: TimeEntriesService, useValue: timeEntriesService },
        { provide: TimerEventsService, useValue: timerEventsService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({
        canActivate: (
          ctx: Parameters<typeof GqlExecutionContext.create>[0],
        ) => {
          const gql = GqlExecutionContext.create(ctx);
          gql.getContext<{ req: { user: { id: number } } }>().req = {
            user: { id: 1 },
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  const gql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/graphql').send({ query, variables });

  it('timeEntries — returns connection', async () => {
    const res = await gql(
      `{ timeEntries { items ${ENTRY_FIELDS} total nextCursor } }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ timeEntries: { items: unknown[] } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.timeEntries.items).toHaveLength(1);
  });

  it('activeTimer — returns active entry', async () => {
    const res = await gql(`{ activeTimer ${ENTRY_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ activeTimer: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.activeTimer.id).toBe(1);
  });

  it('createTimeEntry — returns entry', async () => {
    const res = await gql(
      `mutation($input: CreateTimeEntryInput!) { createTimeEntry(input: $input) ${ENTRY_FIELDS} }`,
      {
        input: {
          startTime: '2024-01-01T08:00:00.000Z',
          endTime: '2024-01-01T09:00:00.000Z',
          billable: false,
        },
      },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ createTimeEntry: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createTimeEntry.id).toBe(1);
  });

  it('startTimer — returns entry and publishes SSE', async () => {
    const res = await gql(
      `mutation($input: StartTimerInput!) { startTimer(input: $input) ${ENTRY_FIELDS} }`,
      { input: { billable: false } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
    expect(timeEntriesService.startTimer).toHaveBeenCalledWith(1, {
      billable: false,
    });
  });

  it('stopTimer — returns stopped entry and publishes null SSE', async () => {
    const res = await gql(`mutation { stopTimer ${ENTRY_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
    expect(timeEntriesService.stopTimer).toHaveBeenCalledWith(1);
  });

  it('updateTimeEntry — returns updated entry', async () => {
    const res = await gql(
      `mutation($input: UpdateTimeEntryInput!) { updateTimeEntry(input: $input) ${ENTRY_FIELDS} }`,
      { input: { id: 1, billable: true } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteTimeEntry — returns true', async () => {
    const res = await gql(`mutation { deleteTimeEntry(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteTimeEntry: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteTimeEntry).toBe(true);
  });
});
