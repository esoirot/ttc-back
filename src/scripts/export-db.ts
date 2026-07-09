import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaClientLike, runExport } from './db-backup.core';

async function main() {
  const dumpDir = process.argv[2];

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const { file, counts } = await runExport(
      prisma as unknown as PrismaClientLike,
      dumpDir,
    );
    for (const [model, count] of Object.entries(counts)) {
      console.log(`exported ${model}: ${count} rows`);
    }
    console.log(`wrote ${file}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
