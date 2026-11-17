#!/usr/bin/env node
'use strict';

// Regression guard for write-profile redaction: the profiler emits evidence
// under `evidence_quotes` (references/user-profiling.md), and the renderer
// prefers that array, so redaction must cover it too. A token in an
// evidence_quotes entry must be replaced with [REDACTED] in USER-PROFILE.md,
// and the "Sensitive Content Excluded" row must count it.
//
// Zero-dep Node harness mirroring tests/state-write-only-parsed.test.cjs.
// CI runs it via `node tests/profile-redact-evidence-quotes.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');
const TOKEN = `ghp_${'a'.repeat(36)}`;

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function writeProfile(evidenceKey) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-redact-'));
  try {
    const input = path.join(dir, 'analysis.json');
    const output = path.join(dir, 'USER-PROFILE.md');
    fs.writeFileSync(input, JSON.stringify({
      profile_version: '1.0',
      data_source: 'test',
      dimensions: {
        communication_style: {
          rating: 'terse-direct',
          confidence: 'HIGH',
          claude_instruction: 'Keep it short.',
          summary: 'Test summary.',
          [evidenceKey]: [
            { signal: 'pastes credentials', quote: `use ${TOKEN} for the API`, project: 'demo' },
          ],
        },
      },
    }), 'utf-8');
    execFileSync(process.execPath, [GSD_TOOLS, 'write-profile', '--input', input, '--output', output], {
      cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return fs.readFileSync(output, 'utf-8');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

for (const key of ['evidence_quotes', 'evidence']) {
  check(`a token under ${key} is redacted in USER-PROFILE.md`, () => {
    const md = writeProfile(key);
    assert.ok(!md.includes(TOKEN), 'token must not reach USER-PROFILE.md');
    assert.ok(md.includes('[REDACTED]'), 'expected [REDACTED] in the evidence line');
    assert.ok(md.includes('1 pattern(s) redacted'), 'expected the redaction count in the profile');
  });
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
