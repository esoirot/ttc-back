import { Test } from '@nestjs/testing';
import { GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TranslationRatesResolver } from './translation-rates.resolver';
import { TranslationRatesService } from './translation-rates.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('TranslationRatesResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service: Partial<Record<keyof TranslationRatesService, jest.Mock>> = {
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
        TranslationRatesResolver,
        { provide: TranslationRatesService, useValue: service },
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

  it('builds a schema exposing translation rate queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('translationRates');
    expect(queries).toHaveProperty('translationRate');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    expect(mutations).toHaveProperty('createTranslationRate');
    expect(mutations).toHaveProperty('updateTranslationRate');
    expect(mutations).toHaveProperty('deleteTranslationRate');
  });
});
