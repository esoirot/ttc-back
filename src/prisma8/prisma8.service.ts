import { Injectable, OnModuleDestroy } from '@nestjs/common';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../../generated/prisma8/contract';
import contractJson from '../../generated/prisma8/contract.json';

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return postgres<Contract>({ url, contractJson });
}

type Client = ReturnType<typeof createClient>;

/** The handle a `transaction` callback receives: same `orm` as the client. */
export type Prisma8Tx = Parameters<Parameters<Client['transaction']>[0]>[0];

/** Prisma 8 client. Coexists with PrismaService until every repository is ported. */
@Injectable()
export class Prisma8Service implements OnModuleDestroy {
  private readonly client = createClient();

  get orm() {
    return this.client.orm;
  }

  /** Commits when `fn` resolves, rolls back when it throws. */
  transaction<T>(fn: (tx: Prisma8Tx) => Promise<T>): Promise<T> {
    return this.client.transaction(fn);
  }

  onModuleDestroy(): Promise<void> {
    return this.client.close();
  }
}
