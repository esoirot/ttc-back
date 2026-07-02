import { Test } from '@nestjs/testing';
import { GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { RateSheetsResolver } from './rate-sheets.resolver';
import { RateSheetsService } from './rate-sheets.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('RateSheetsResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service: Partial<Record<keyof RateSheetsService, jest.Mock>> = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
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
        RateSheetsResolver,
        { provide: RateSheetsService, useValue: service },
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

  it('builds a schema exposing rate sheet queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('rateSheets');
    expect(queries).toHaveProperty('rateSheet');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    expect(mutations).toHaveProperty('createRateSheet');
    expect(mutations).toHaveProperty('updateRateSheet');
    expect(mutations).toHaveProperty('deleteRateSheet');
  });
});
