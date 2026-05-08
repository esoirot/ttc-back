import { join } from 'path';
import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { AuthModule } from './auth/auth.module';
import { ClockifyModule } from './clockify/clockify.module';
import { HubspotModule } from './hubspot/hubspot.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({
        request,
        reply,
      }: {
        request: FastifyRequest;
        reply: FastifyReply;
      }) => ({
        req: request,
        res: reply,
      }),
    }),
    AuthModule,
    UsersModule,
    ProjectsModule,
    ClockifyModule,
    HubspotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
