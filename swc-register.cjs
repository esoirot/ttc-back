// Custom require() hook for running .ts sources directly under Node.
//
// TypeScript 7 dropped the classic compiler API from `require('typescript')`
// (only `version`/`versionMajorMinor` remain), which breaks every tool that
// still calls into it at load time: ts-node, @swc-node/register (both crash
// reading `ts.Extension`/`ts.sys`), and @nestjs/cli's own tsconfig reader.
// tsx (esbuild) avoids that crash but esbuild does not implement
// `emitDecoratorMetadata` at all, so NestJS's constructor-based DI silently
// receives `undefined` for every injected dependency.
//
// This hooks `.ts` requires directly through @swc/core's transform API
// (same engine already used by @swc/jest, which does emit correct
// design:paramtypes metadata) without ever touching the `typescript` package.
const { transformSync } = require('@swc/core');
const Module = require('module');
const fs = require('fs');

const swcOptions = {
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2022',
  },
  module: { type: 'commonjs' },
  sourceMaps: 'inline',
};

Module._extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = transformSync(source, { ...swcOptions, filename });
  module._compile(code, filename);
};

// nodenext-style relative imports (e.g. the generated Prisma client) use
// explicit `.js` extensions that point at `.ts` sources pre-compile —
// mirrors the `moduleNameMapper` rewrite already used in the jest config.
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  try {
    return originalResolveFilename.call(this, request, ...rest);
  } catch (err) {
    if (request.endsWith('.js')) {
      return originalResolveFilename.call(this, request.slice(0, -3), ...rest);
    }
    throw err;
  }
};
