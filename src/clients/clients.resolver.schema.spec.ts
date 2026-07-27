import { Test } from '@nestjs/testing';
import {
  GraphQLModule,
  GraphQLSchemaHost,
  GqlExecutionContext,
} from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ClientsResolver } from './clients.resolver';
import { ClientsService } from './clients.service';
import { ClientStatusHistoryService } from './client-status-history.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors TasksResolver's schema spec.
describe('ClientsResolver GraphQL schema', () => {
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
        ClientsResolver,
        {
          provide: ClientsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              userId: 1,
              name: 'Client',
              clientType: 'COMPANY',
              status: 'CLIENT',
              billingEndOfMonth: false,
              contacts: [],
              tags: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        },
        {
          provide: ClientStatusHistoryService,
          useValue: { findByClient: jest.fn().mockResolvedValue([]) },
        },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({
        canActivate: (
          ctx: Parameters<typeof GqlExecutionContext.create>[0],
        ) => {
          const gql = GqlExecutionContext.create(ctx);
          gql.getContext<{
            req: { user: { id: number } };
          }>().req = { user: { id: 1 } };
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

  it('builds a schema exposing the statusHistory field resolver on Client', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const clientType = schema.getType('Client') as unknown as {
      getFields: () => Record<string, unknown>;
    };
    const clientFields = clientType.getFields();
    expect(clientFields).toHaveProperty('statusHistory');
  });

  // Field-level `@ResolveField(() => Foo)` return-type thunks are resolved
  // lazily by graphql-js on first real query execution, not eagerly at
  // schema-build time (unlike root @Query/@Mutation thunks). Only an actual
  // query forces them to run.
  it('resolves the statusHistory field through a live query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{
          client(id: 1) {
            id
            statusHistory { id }
          }
        }`,
      },
    });

    const body = JSON.parse(res.payload) as {
      data?: { client?: { id: number; statusHistory: unknown[] } };
      errors?: { message: string }[];
    };
    expect(body.errors).toBeUndefined();
    expect(body.data?.client?.id).toBe(1);
    expect(body.data?.client?.statusHistory).toEqual([]);
  });
});
