import './instrument';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import type { FastifyCookieOptions } from '@fastify/cookie';

type CompatReply = FastifyReply & {
  setHeader?: (name: string, value: string) => void;
  end?: (data?: string) => void;
};

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // Passport.js was written for Express and calls res.setHeader / res.end during
  // OAuth redirects. Fastify's reply wrapper doesn't have those — shim them.
  const fastifyInstance = app.getHttpAdapter().getInstance();

  await fastifyInstance.register(
    fastifyCookie as unknown as Parameters<typeof fastifyInstance.register>[0],
    {
      secret:
        process.env.COOKIE_SECRET ?? 'fallback-secret-change-in-production',
    } as FastifyCookieOptions,
  );

  fastifyInstance.addHook('onRequest', async (_req, reply) => {
    const compat = reply as CompatReply;
    if (!compat.setHeader) {
      compat.setHeader = (name: string, value: string): void => {
        reply.header(name, value);
      };
    }
    if (!compat.end) {
      compat.end = (data?: string): void => {
        if (!reply.sent) void reply.send(data ?? '');
      };
    }
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('The Translator Companion API')
    .setDescription('The Translator Companion API description')
    .setVersion('0.1')
    .addTag('hubspot things')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
