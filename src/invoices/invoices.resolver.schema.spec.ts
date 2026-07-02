import { Test } from '@nestjs/testing';
import { GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { InvoicesResolver } from './invoices.resolver';
import { InvoicesService } from './invoices.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('InvoicesResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service: Partial<Record<keyof InvoicesService, jest.Mock>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      generate: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
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
        InvoicesResolver,
        { provide: InvoicesService, useValue: service },
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

  it('builds a schema exposing invoice queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('invoices');
    expect(queries).toHaveProperty('invoice');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    for (const name of [
      'createInvoice',
      'generateInvoice',
      'updateInvoice',
      'deleteInvoice',
      'addInvoiceItem',
      'updateInvoiceItem',
      'removeInvoiceItem',
    ]) {
      expect(mutations).toHaveProperty(name);
    }
  });
});
