import 'dotenv/config';
import { Prisma8Service } from '../prisma8/prisma8.service';
import { runExport } from './db-backup.core';
import { prisma8BackupClient } from './db-backup.prisma8';

async function main() {
  const dumpDir = process.argv[2];
  const db = new Prisma8Service();

  try {
    const { file, counts } = await runExport(prisma8BackupClient(db), dumpDir);
    for (const [model, count] of Object.entries(counts)) {
      console.log(`exported ${model}: ${count} rows`);
    }
    console.log(`wrote ${file}`);
  } finally {
    await db.onModuleDestroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
