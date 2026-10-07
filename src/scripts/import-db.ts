import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Pool } from 'pg';
import { Prisma8Service } from '../prisma8/prisma8.service';
import { MODEL_ORDER, hasSerialId } from './db-sync.util';
import { latestBackupPath } from './db-backup.core';
import { importBackup8 } from './db-backup.prisma8';

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

  const db = new Prisma8Service();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await importBackup8(
      db,
      payload.data as Record<string, Record<string, unknown>[]>,
      console.log,
    );

    for (const model of MODEL_ORDER.filter(hasSerialId)) {
      await pool.query(
        `SELECT setval(pg_get_serial_sequence('"${model}"', 'id'), COALESCE((SELECT MAX(id) FROM "${model}"), 1))`,
      );
    }

    console.log('import complete, sequences reset');
  } finally {
    await db.onModuleDestroy();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
