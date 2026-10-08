import 'dotenv/config';
import { Client } from 'pg';
import { migrateRefusal, readDbState } from './migrate-guard.core';

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const refusal = migrateRefusal(await readDbState((sql) => db.query(sql)));
    if (refusal) {
      console.error(refusal);
      process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
