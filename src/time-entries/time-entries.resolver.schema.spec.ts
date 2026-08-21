import { Test } from '@nestjs/testing';
import { GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TimeEntriesResolver } from './time-entries.resolver';
import { TimeEntriesService } from './time-entries.service';
import { TimerEventsService } from '../timer-events/timer-events.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('TimeEntriesResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
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
        { provide: TimeEntriesService, useValue: {} },
        { provide: TimerEventsService, useValue: {} },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('builds a schema exposing time entry queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('timeEntries');
    expect(queries).toHaveProperty('activeTimer');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    for (const name of [
      'createTimeEntry',
      'startTimer',
      'stopTimer',
      'updateTimeEntry',
      'resumeTimeEntry',
      'deleteTimeEntry',
    ]) {
      expect(mutations).toHaveProperty(name);
    }

    const timeEntryType = schema.getType('TimeEntry') as unknown as {
      getFields: () => Record<string, unknown>;
    };
    const timeEntryFields = timeEntryType.getFields();
    expect(timeEntryFields).toHaveProperty('activities');
    expect(timeEntryFields).toHaveProperty('activity');
    expect(timeEntryFields).toHaveProperty('activityId');
    expect(timeEntryFields).toHaveProperty('wordsProcessed');

    const updateInputType = schema.getType(
      'UpdateTimeEntryInput',
    ) as unknown as {
      getFields: () => Record<string, unknown>;
    };
    expect(updateInputType.getFields()).toHaveProperty('activityId');
    expect(updateInputType.getFields()).toHaveProperty('wordsProcessed');
  });
});
