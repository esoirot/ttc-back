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
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
// Side effect: registers RateType as a GraphQL enum. AdminResolver's
// `findRates`/rate mutations reference the raw generated-Prisma RateType,
// which is only wired into the schema once this module has been loaded.
import '../client-rates/entities/client-rate.entity';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Bar`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('AdminResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service: Partial<Record<keyof AdminService, jest.Mock>> = {
      getStats: jest.fn(),
      findClients: jest
        .fn()
        .mockResolvedValue({ items: [], nextCursor: null, total: 0 }),
      findProjects: jest.fn(),
      findInvoices: jest.fn(),
      findTimeEntries: jest.fn(),
      findRates: jest.fn(),
      createClient: jest.fn(),
      updateClient: jest.fn(),
      deleteClient: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      deleteTimeEntry: jest.fn(),
      createRate: jest.fn(),
      updateRate: jest.fn(),
      deleteRate: jest.fn(),
    };

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
      providers: [AdminResolver, { provide: AdminService, useValue: service }],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (
          ctx: Parameters<typeof GqlExecutionContext.create>[0],
        ) => {
          const gql = GqlExecutionContext.create(ctx);
          gql.getContext<{
            req: { user: { id: number; role: string } };
          }>().req = { user: { id: 99, role: 'ADMIN' } };
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

  it('builds a schema exposing all admin queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('adminStats');
    expect(queries).toHaveProperty('adminClients');
    expect(queries).toHaveProperty('adminProjects');
    expect(queries).toHaveProperty('adminInvoices');
    expect(queries).toHaveProperty('adminTimeEntries');
    expect(queries).toHaveProperty('adminRates');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    expect(mutations).toHaveProperty('adminCreateClient');
    expect(mutations).toHaveProperty('adminUpdateClient');
    expect(mutations).toHaveProperty('adminDeleteClient');
    expect(mutations).toHaveProperty('adminCreateProject');
    expect(mutations).toHaveProperty('adminUpdateProject');
    expect(mutations).toHaveProperty('adminDeleteProject');
    expect(mutations).toHaveProperty('adminUpdateInvoice');
    expect(mutations).toHaveProperty('adminDeleteInvoice');
    expect(mutations).toHaveProperty('adminDeleteTimeEntry');
    expect(mutations).toHaveProperty('adminCreateRate');
    expect(mutations).toHaveProperty('adminUpdateRate');
    expect(mutations).toHaveProperty('adminDeleteRate');
  });

  it('adminClients query resolves through the guarded schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ adminClients { items { id } total nextCursor } }' },
    });

    const body = JSON.parse(res.payload) as {
      data?: { adminClients?: { items: unknown[]; total: number } };
      errors?: { message: string }[];
    };
    expect(body.errors).toBeUndefined();
    expect(body.data?.adminClients?.items).toEqual([]);
    expect(body.data?.adminClients?.total).toBe(0);
  });
});
