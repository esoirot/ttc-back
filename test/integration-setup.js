// Brings the integration test database to the current schema before the run.
// The URL comes from .env.test only, and anything but ttc_test is refused,
// so this can never migrate the dev or production database.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('dotenv');

module.exports = () => {
  const root = resolve(__dirname, '..');
  const { DATABASE_URL } = parse(readFileSync(resolve(root, '.env.test')));
  if (!DATABASE_URL?.includes('/ttc_test')) {
    throw new Error(
      `integration tests need a ttc_test database, got ${DATABASE_URL}`,
    );
  }
  execFileSync(
    'pnpm',
    ['exec', 'prisma7', 'migrate', 'deploy', '--config', 'prisma7.config.ts'],
    { cwd: root, env: { ...process.env, DATABASE_URL }, stdio: 'ignore' },
  );
};
