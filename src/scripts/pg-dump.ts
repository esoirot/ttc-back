import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDumpFilename, toPgDumpUrl } from './pg-dump.core';

function run(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(
      `${cmd} not found — install it with: sudo apt install postgresql-client`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const dumpDir = process.argv[2] ?? join(process.cwd(), 'db_dump');
  mkdirSync(dumpDir, { recursive: true });
  const file = join(dumpDir, buildDumpFilename(new Date()));

  run('pg_dump', ['-Fc', '-f', file, toPgDumpUrl(databaseUrl)]);

  // A dump pg_restore cannot list is no backup.
  const tables = run('pg_restore', ['-l', file])
    .split('\n')
    .filter((line) => / TABLE DATA /.test(line)).length;
  if (tables === 0) throw new Error(`${file} contains no table data`);

  const sizeKb = Math.round(statSync(file).size / 1024);
  console.log(`wrote ${file} (${sizeKb} KB, ${tables} tables)`);
  console.log('copy it somewhere safe before migrating');
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
