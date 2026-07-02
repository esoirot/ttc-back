import { Test } from '@nestjs/testing';
import { GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('AuthResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service: Partial<Record<keyof AuthService, jest.Mock>> = {
      getUser: jest.fn(),
      updateMe: jest.fn(),
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      validateUser: jest.fn(),
      setupTwoFactor: jest.fn(),
      enableTwoFactor: jest.fn(),
      disableTwoFactor: jest.fn(),
      verifyTwoFactor: jest.fn(),
      verifyTwoFactorBackup: jest.fn(),
      regenerateBackupCodes: jest.fn(),
      adminDisableTwoFactor: jest.fn(),
      getBackupCodeCount: jest.fn(),
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
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
      providers: [AuthResolver, { provide: AuthService, useValue: service }],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('builds a schema exposing all auth queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('me');
    expect(queries).toHaveProperty('backupCodeCount');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    for (const name of [
      'updateMe',
      'register',
      'login',
      'logout',
      'refreshToken',
      'setupTwoFactor',
      'enableTwoFactor',
      'disableTwoFactor',
      'verifyTwoFactor',
      'verifyTwoFactorBackup',
      'regenerateBackupCodes',
      'adminDisableTwoFactor',
      'changePassword',
      'deleteAccount',
      'requestPasswordReset',
      'resetPassword',
    ]) {
      expect(mutations).toHaveProperty(name);
    }
  });
});
