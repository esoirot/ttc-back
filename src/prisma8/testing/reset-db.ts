import { Pool } from 'pg';

/** Empties every application table in the test database (keeps migration history). */
export async function resetDb(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url?.includes('ttc_test')) {
    throw new Error(`refusing to reset a non-test database: ${url}`);
  }
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
    await pool.query(`truncate ${tables} restart identity cascade`);
  } finally {
    await pool.end();
  }
}
