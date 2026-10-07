import { Global, Module } from '@nestjs/common';
import { Prisma8Service } from './prisma8.service';

/** One Prisma 8 client (one connection pool) for the whole app. */
@Global()
@Module({ providers: [Prisma8Service], exports: [Prisma8Service] })
export class Prisma8Module {}
