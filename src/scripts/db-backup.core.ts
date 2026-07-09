import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { MODEL_ORDER, toClientProperty } from './db-sync.util';

const DUMP_DIR = join(process.cwd(), 'db_dump');
const MAX_BACKUPS = 5;

const BACKUP_FILE_RE = /^db-backup-.*\.json$/;

export type PrismaClientLike = Record<
  string,
  { findMany: (args: unknown) => Promise<unknown[]> }
>;

export function buildBackupFilename(date: Date): string {
  return `db-backup-${date.toISOString().replace(/[:.]/g, '-')}.json`;
}

/** Given filenames in a dump dir, returns the oldest `db-backup-*.json` ones beyond maxKept. */
export function selectFilesToDelete(
  filenames: string[],
  maxKept: number,
): string[] {
  const backups = filenames.filter((f) => BACKUP_FILE_RE.test(f)).sort();
  if (backups.length <= maxKept) return [];
  return backups.slice(0, backups.length - maxKept);
}

function listBackupsNewestFirst(dumpDir: string): string[] {
  if (!existsSync(dumpDir)) return [];
  return readdirSync(dumpDir)
    .filter((f) => BACKUP_FILE_RE.test(f))
    .sort()
    .reverse();
}

export function latestBackupPath(
  dumpDir: string = DUMP_DIR,
): string | undefined {
  const [latest] = listBackupsNewestFirst(dumpDir);
  return latest ? join(dumpDir, latest) : undefined;
}

export async function runExport(
  prisma: PrismaClientLike,
  dumpDir: string = DUMP_DIR,
): Promise<{ file: string; counts: Record<string, number> }> {
  mkdirSync(dumpDir, { recursive: true });

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const model of MODEL_ORDER) {
    const rows = await prisma[toClientProperty(model)].findMany({
      orderBy: { id: 'asc' },
    });
    data[model] = rows;
    counts[model] = rows.length;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    models: MODEL_ORDER,
    data,
  };

  const filePath = join(dumpDir, buildBackupFilename(new Date()));
  writeFileSync(filePath, JSON.stringify(payload, null, 2));

  const toDelete = selectFilesToDelete(readdirSync(dumpDir), MAX_BACKUPS);
  for (const filename of toDelete) {
    unlinkSync(join(dumpDir, filename));
  }

  return { file: filePath, counts };
}
