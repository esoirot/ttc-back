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
import { ProjectsResolver } from './projects.resolver';
import { ProjectsService } from './projects.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('ProjectsResolver GraphQL schema', () => {
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
            loaders: {
              totalSecondsByProject: {
                load: jest.fn().mockResolvedValue(60),
              },
            },
          }),
        }),
      ],
      providers: [
        ProjectsResolver,
        {
          provide: ProjectsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              title: 'Project',
              status: 'ACTIVE',
              currency: 'EUR',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: jest.fn(),
            delete: jest.fn(),
          },
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
            req: { user: { id: number; role: string } };
          }>().req = { user: { id: 1, role: 'ADMIN' } };
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

  it('builds a schema exposing project queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('projects');
    expect(queries).toHaveProperty('project');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    expect(mutations).toHaveProperty('createProject');
    expect(mutations).toHaveProperty('updateProject');
    expect(mutations).toHaveProperty('deleteProject');
  });

  // @ResolveField return-type thunks resolve lazily on first real query
  // execution, not eagerly at schema-build time — only a live query forces
  // this one to run (see tasks.resolver.schema.spec.ts for the same note).
  it('resolves totalTimeSeconds through a live query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ project(id: 1) { id totalTimeSeconds } }' },
    });

    const body = JSON.parse(res.payload) as {
      data?: { project?: { totalTimeSeconds: number | null } };
      errors?: { message: string }[];
    };
    expect(body.errors).toBeUndefined();
    expect(body.data?.project?.totalTimeSeconds).toBe(60);
  });
});
