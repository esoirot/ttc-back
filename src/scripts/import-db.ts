import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { MODEL_ORDER, toClientProperty } from './db-sync.util';
import { latestBackupPath } from './db-backup.core';

interface ExportPayload {
  exportedAt: string;
  models: readonly string[];
  data: Record<string, unknown[]>;
}

async function confirm(): Promise<void> {
  if (process.argv.includes('--yes')) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    'This will DELETE ALL existing data and replace it with the backup file. Type YES to continue: ',
  );
  rl.close();

  if (answer !== 'YES') {
    console.log('aborted');
    process.exit(1);
  }
}

async function main() {
  const explicitPath =
    process.argv[2] && !process.argv[2].startsWith('--')
      ? process.argv[2]
      : undefined;
  const inputPath = explicitPath ?? latestBackupPath();

  if (!inputPath) {
    console.error(
      'no backup file found in db_dump/ and none given as an argument',
    );
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(inputPath, 'utf-8')) as ExportPayload;

  await confirm();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await prisma.$transaction(
      async (tx) => {
        const txClient = tx as unknown as Record<
          string,
          {
            deleteMany: () => Promise<unknown>;
            createMany: (args: {
              data: unknown[];
              skipDuplicates: boolean;
            }) => Promise<unknown>;
          }
        >;

        for (const model of [...MODEL_ORDER].reverse()) {
          await txClient[toClientProperty(model)].deleteMany();
        }

        for (const model of MODEL_ORDER) {
          const rows = payload.data[model] ?? [];
          if (rows.length === 0) continue;
          await txClient[toClientProperty(model)].createMany({
            data: rows,
            skipDuplicates: true,
          });
          console.log(`imported ${model}: ${rows.length} rows`);
        }
      },
      { timeout: 120_000 },
    );

    for (const model of MODEL_ORDER) {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${model}"', 'id'), COALESCE((SELECT MAX(id) FROM "${model}"), 1))`,
      );
    }

    console.log('import complete, sequences reset');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
