#!/usr/bin/env node
// Deterministic TS to CJS generator for the STATE.md document module.
// Transpiles sdk/src/query/state-document.ts into bin/lib/state-document.generated.cjs
// so the CJS twin always stays a byte-for-byte projection of the single source.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, '../src/query/state-document.ts');
const defaultOut = resolve(here, '../../bin/lib/state-document.generated.cjs');

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const outIndex = args.indexOf('--out');
const outPath = outIndex !== -1 && args[outIndex + 1] ? resolve(args[outIndex + 1]) : defaultOut;

const source = readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    removeComments: false,
    newLine: ts.NewLineKind.LineFeed,
  },
});

const header = [
  "'use strict';",
  '',
  '/*',
  ' * GENERATED FILE - DO NOT EDIT.',
  ' *',
  ' * Source: sdk/src/query/state-document.ts',
  ' * Regenerate: cd sdk && npm run gen:state-document',
  ' *',
  ' * Pure transforms for STATE.md text (no filesystem, persistence, or locking).',
  ' */',
  '',
  '',
].join('\n');

const body = transpiled.outputText.replace(/\n+$/, '');
const output = `${header}${body}\n`;

if (checkMode) {
  const current = readFileSync(defaultOut, 'utf8');
  if (current !== output) {
    console.error('state-document.generated.cjs is stale. Run: cd sdk && npm run gen:state-document');
    process.exit(1);
  }
  console.log('state-document.generated.cjs is fresh.');
  process.exit(0);
}

writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);
