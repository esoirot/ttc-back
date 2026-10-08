// Jest runs CommonJS; the Prisma 8 runtime and some of its dependencies ship
// ESM only. Compile a node_modules file with SWC only when Node itself would
// treat it as ESM (.mjs, or .js under a "type": "module" package.json), so
// CommonJS packages pass through untouched.
const { existsSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { createTransformer } = require('@swc/jest');

const swc = createTransformer({
  jsc: { target: 'es2022' },
  module: { type: 'commonjs' },
});

const typeByDir = new Map();

function packageType(dir) {
  if (typeByDir.has(dir)) return typeByDir.get(dir);
  const pkg = join(dir, 'package.json');
  const parent = dirname(dir);
  const type = existsSync(pkg)
    ? (JSON.parse(readFileSync(pkg, 'utf8')).type ?? 'commonjs')
    : parent === dir
      ? 'commonjs'
      : packageType(parent);
  typeByDir.set(dir, type);
  return type;
}

function isEsm(filename) {
  if (filename.endsWith('.mjs')) return true;
  if (filename.endsWith('.cjs')) return false;
  return packageType(dirname(filename)) === 'module';
}

module.exports = {
  process(src, filename, options) {
    if (!isEsm(filename)) return { code: src };
    return swc.process(src, filename, options);
  },
  getCacheKey(src, filename, options) {
    return swc.getCacheKey(src, filename, options);
  },
};
