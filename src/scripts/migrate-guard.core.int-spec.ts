import { Client } from 'pg';
import { readDbState } from './migrate-guard.core';

describe('readDbState', () => {
  it('sees the signed, migrated test database', async () => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      await expect(readDbState((sql) => db.query(sql))).resolves.toEqual({
        signed: true,
        hasTables: true,
      });
    } finally {
      await db.end();
    }
  });
});
