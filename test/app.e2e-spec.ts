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
import { ProjectsResolver } from '../src/projects/projects.resolver';
import { ProjectsService } from '../src/projects/projects.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import {
  Project,
  ProjectStatus,
} from '../src/projects/entities/project.entity';
import { ProjectConnection } from '../src/projects/types/project-connection.type';

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('App smoke (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue(
        Object.assign(new ProjectConnection(), {
          items: [],
          nextCursor: null,
          total: 0,
        }),
      ),
      findOne: jest.fn().mockResolvedValue(
        Object.assign(new Project(), {
          id: 1,
          title: 'Smoke',
          status: ProjectStatus.ACTIVE,
          currency: 'EUR',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      update: jest.fn(),
      delete: jest.fn(),
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
      providers: [
        ProjectsResolver,
        { provide: ProjectsService, useValue: service },
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

  it('GraphQL endpoint responds', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ __typename }' });
    expect(res.status).toBe(200);
    const body = gqlBody<{ __typename: string }>(res);
    expect(body.data?.__typename).toBe('Query');
  });

  it('projects query resolves', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ projects { items { id title } total nextCursor } }' });
    expect(res.status).toBe(200);
    const body = gqlBody<{ projects: { total: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.projects.total).toBe(0);
  });

  it('project(id) query resolves', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ project(id: 1) { id title status } }' });
    expect(res.status).toBe(200);
    const body = gqlBody<{ project: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.project.id).toBe(1);
  });
});
