import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ScheduleModule } from '@nestjs/schedule';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ClientsModule } from './clients/clients.module';
import { TasksModule } from './tasks/tasks.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AuthModule } from './auth/auth.module';
import { ClockifyModule } from './clockify/clockify.module';
import { HubspotModule } from './hubspot/hubspot.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PubSubModule } from './common/pubsub.module';
import { CleanupModule } from './common/cleanup/cleanup.module';
import { RatesModule } from './rates/rates.module';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        COOKIE_SECRET: Joi.string().min(32).required(),
        FRONTEND_URL: Joi.string().default('http://localhost:5173'),
        PORT: Joi.number().default(3000),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        CLOCKIFY_API_URL: Joi.string().default(
          'https://api.clockify.me/api/v1',
        ),
        GOOGLE_CALLBACK_URL: Joi.string().default(
          'http://localhost:3000/auth/google/callback',
        ),
        HUBSPOT_REDIRECT_URI: Joi.string().default(
          'http://localhost:3000/hubspot/auth/callback',
        ),
        SMTP_PORT: Joi.number().default(587),
        SMTP_FROM: Joi.string().default('noreply@ttc.local'),
        AUDIT_RETENTION_DAYS: Joi.number().default(90),
        APP_ENCRYPTION_KEY: Joi.string().length(64).required(),
        SENTRY_DSN: Joi.string().optional(),
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().optional(),
        HUBSPOT_CLIENT_ID: Joi.string().optional(),
        HUBSPOT_CLIENT_SECRET: Joi.string().optional(),
        HUBSPOT_WEBHOOK_SECRET: Joi.string().optional(),
        HUBSPOT_APP_ID: Joi.string().optional(),
        HUBSPOT_PRIVATE_APP_TOKEN: Joi.string().optional(),
        SMTP_HOST: Joi.string().optional(),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        ),
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // @as-integrations/fastify@3 calls context(request, reply) as two
      // positional args, not as a single { request, reply } object.
      context: (request: FastifyRequest, reply: FastifyReply) => ({
        req: request,
        res: reply,
      }),
    }),
    AuthModule,
    UsersModule,
    ProjectsModule,
    ClientsModule,
    TasksModule,
    TimeEntriesModule,
    InvoicesModule,
    ClockifyModule,
    HubspotModule,
    AuditModule,
    DashboardModule,
    PubSubModule,
    CleanupModule,
    RatesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
