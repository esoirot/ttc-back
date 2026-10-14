// `pnpm run check [--skip name[,name…]]… [--list]`
// Runs every gate in order and stops at the first failure.
import { spawnSync } from 'node:child_process';

const STEPS = [
  ['typecheck', 'pnpm run typecheck'],
  ['circular', 'pnpm run circular'],
  ['depcheck', 'pnpm exec depcheck'],
  ['prune', 'pnpm run prune'],
  ['format', 'pnpm run format:check'],
  // fails instead of fixing; `pnpm run lint` fixes
  [
    'lint',
    './.lint-tools/node_modules/.bin/eslint -c .lint-tools/eslint.config.mjs "{src,apps,libs,test}/**/*.ts"',
  ],
  ['audit', 'pnpm run audit'],
  ['unit', 'pnpm run test'],
  ['integration', 'pnpm run test:integration'], // needs the ttc_test database
  ['e2e', 'pnpm run test:e2e'],
  ['build', 'pnpm run build'],
  ['mutation', 'pnpm run test:mutation:changed'], // needs the ttc_test database
];
const NAMES = STEPS.map(([name]) => name);

const skip = new Set();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--list') {
    console.log(NAMES.join('\n'));
    process.exit(0);
  }
  const value = arg.startsWith('--skip=')
    ? arg.slice('--skip='.length)
    : arg === '--skip'
      ? args[++i]
      : undefined;
  if (value === undefined) {
    console.error(`Unknown argument "${arg}". Use --skip <steps> or --list.`);
    process.exit(2);
  }
  for (const name of value
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)) {
    if (!NAMES.includes(name)) {
      console.error(`Unknown step "${name}". Steps: ${NAMES.join(', ')}.`);
      process.exit(2);
    }
    skip.add(name);
  }
}

const results = [];
let failed = null;
for (const [name, command] of STEPS) {
  if (skip.has(name)) {
    results.push(`  - ${name} (skipped)`);
    continue;
  }
  console.log(`\n▶ ${name}: ${command}`);
  const started = Date.now();
  const { status } = spawnSync(command, { shell: true, stdio: 'inherit' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push(`  ${status === 0 ? '✓' : '✗'} ${name} (${seconds}s)`);
  if (status !== 0) {
    failed = name;
    break;
  }
}

console.log(`\ncheck ${failed ? `failed at "${failed}"` : 'passed'}:`);
console.log(results.join('\n'));
process.exit(failed ? 1 : 0);
