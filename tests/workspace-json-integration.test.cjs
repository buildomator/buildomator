'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOK_BIN = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-workspace-test-'));
  fs.mkdirSync(path.join(dir, '.agents'), { recursive: true });
  return dir;
}

// Always cleans up dir even when the test body throws.
function withTempRepo(fn, opts) {
  const legacy = opts && opts.legacy;
  const dir = legacy
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-workspace-legacy-'))
    : makeTempRepo();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeCanonicalWorkspaceJson(dir, content) {
  fs.writeFileSync(
    path.join(dir, '.agents', 'agents.workspace.json'),
    JSON.stringify(content, null, 2)
  );
}

function writeLegacyWorkspaceJson(dir, content) {
  fs.writeFileSync(
    path.join(dir, 'agents.workspace.json'),
    JSON.stringify(content, null, 2)
  );
}

function runHook(cwd) {
  const result = spawnSync('node', [HOOK_BIN, 'hook', 'session-start'], {
    cwd,
    encoding: 'utf-8',
    timeout: 5000,
    input: JSON.stringify({ source: 'startup' }),
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push([true, name]);
  } catch (err) {
    checks.push([false, `${name}: ${err.message}`]);
  }
}

// Test 1: absent file produces zero workspace.json output
check('absent file produces no workspace.json injection', () => withTempRepo(dir => {
  const result = runHook(dir);
  if (result.stdout.includes('workspace.json')) {
    throw new Error('Hook injected workspace.json context when file was absent');
  }
}));

// Test 2: malformed file fails soft
check('malformed file does not crash hook', () => withTempRepo(dir => {
  fs.writeFileSync(path.join(dir, '.agents', 'agents.workspace.json'), '{not valid json');
  const result = runHook(dir);
  if (result.status !== 0) {
    throw new Error(`Hook exited with status ${result.status} on malformed file`);
  }
}));

// Test 3: valid canonical-path file injects expected fragile files
check('canonical-path file injects fragility intelligence', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/auth/middleware.ts': {
          fragility: 0.91,
          aiModificationCount: 8,
          humanModificationCount: 2,
        },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/auth/middleware.ts')) {
    throw new Error('Hook did not inject fragile file path');
  }
  if (!result.stdout.includes('0.91')) {
    throw new Error('Hook did not inject fragility score');
  }
}));

// Test 4: legacy-path file is also read
check('legacy-path file is read when canonical absent', () => withTempRepo(dir => {
  writeLegacyWorkspaceJson(dir, {
    version: '1.0',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/legacy.ts': {
          fragility: 0.85,
          aiModificationCount: 5,
          humanModificationCount: 1,
        },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/legacy.ts')) {
    throw new Error('Legacy-path workspace.json was not read');
  }
}, { legacy: true }));

// Test 5: canonical wins when both present
check('canonical path wins when both present', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/canonical.ts': { fragility: 0.91, aiModificationCount: 5, humanModificationCount: 1 },
      },
    },
  });
  writeLegacyWorkspaceJson(dir, {
    version: '1.0',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/legacy.ts': { fragility: 0.91, aiModificationCount: 5, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/canonical.ts')) {
    throw new Error('Canonical path file was not preferred');
  }
  if (result.stdout.includes('src/legacy.ts')) {
    throw new Error('Legacy file should not be read when canonical exists');
  }
}));

// Test 6: framework manifest with low confidence is filtered
check('framework manifest filters low-confidence entries', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    generated: {
      version: '1.0',
      frameworkManifest: [
        { name: 'next', version: '14.2', confidence: 0.99 },
        { name: 'unknown-framework', version: '?', confidence: 0.3 },
      ],
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('next@14.2')) {
    throw new Error('High-confidence framework not injected');
  }
  if (result.stdout.includes('unknown-framework')) {
    throw new Error('Low-confidence framework should have been filtered');
  }
}));

// Test 7: fragility threshold of 0.7 is enforced (per spec section 3.5)
check('files below 0.7 fragility threshold are not injected', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/high.ts': { fragility: 0.85, aiModificationCount: 5, humanModificationCount: 1 },
        'src/low.ts': { fragility: 0.5, aiModificationCount: 2, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/high.ts')) {
    throw new Error('Above-threshold file was not injected');
  }
  if (result.stdout.includes('src/low.ts')) {
    throw new Error('Below-threshold file should have been filtered per spec section 3.5');
  }
}));

// Test 8: manual.fragileFiles injection works (spec shape: { path, reason })
check('manual.fragileFiles are injected', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    manual: {
      fragileFiles: [
        { path: 'packages/auth/src/index.ts', reason: 'Single point of failure for all authentication. High blast radius.' },
      ],
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('packages/auth/src/index.ts')) {
    throw new Error('Manual fragile file path not injected');
  }
  if (!result.stdout.includes('Single point of failure')) {
    throw new Error('Manual fragile file reason not injected');
  }
}));

// Test 9: coChangePatterns are injected (spec shape: { files, note })
check('coChangePatterns are injected', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    manual: {
      coChangePatterns: [
        {
          files: ['packages/contracts/src/user.ts', 'apps/api/src/routes/users.ts'],
          note: 'Schema changes require simultaneous API route updates.',
        },
      ],
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('packages/contracts/src/user.ts')) {
    throw new Error('coChangePattern files not injected');
  }
  if (!result.stdout.includes('Schema changes')) {
    throw new Error('coChangePattern note not injected');
  }
}));

// Test 10: HANDOFF.json read is unaffected by workspace.json presence
check('HANDOFF.json injection still works alongside workspace.json', () => withTempRepo(dir => {
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.planning', 'HANDOFF.json'),
    JSON.stringify({
      version: '1.0',
      phase_name: 'Phase 4',
      plan: '01',
      task: 3,
      source: 'manual-pause',
      partial: false,
    })
  );
  writeCanonicalWorkspaceJson(dir, { version: '1.0', generated: { version: '1.0' } });
  const result = runHook(dir);
  if (!result.stdout.includes('Phase 4')) {
    throw new Error('HANDOFF.json injection regressed');
  }
}));

// Test 11: DEFAULT_MAX_FILES cap enforced — 8 files above threshold, only 5 in output
check('DEFAULT_MAX_FILES cap is enforced (8 files in, 5 out)', () => withTempRepo(dir => {
  const fileIndex = {};
  for (let i = 1; i <= 8; i++) {
    fileIndex[`src/file${i}.ts`] = {
      fragility: 0.70 + (i * 0.01),
      aiModificationCount: i,
      humanModificationCount: 1,
    };
  }
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    generated: { version: '1.0', fileIndex },
  });
  const result = runHook(dir);
  let injectedCount = 0;
  for (let i = 1; i <= 8; i++) {
    if (result.stdout.includes(`src/file${i}.ts`)) injectedCount += 1;
  }
  if (injectedCount !== 5) {
    throw new Error(`Expected 5 files injected (DEFAULT_MAX_FILES), got ${injectedCount}`);
  }
}));

// Test 12: mixed manual.fragileFiles — valid entries inject, invalid entries are skipped
check('mixed manual.fragileFiles skips invalid entries without crashing', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '1.0',
    manual: {
      fragileFiles: [
        { path: 'src/valid.ts', reason: 'Known fragile.' },
        'bare string entry',
        null,
        { path: 'src/missing-reason.ts' },
        { reason: 'missing path' },
      ],
    },
  });
  const result = runHook(dir);
  if (result.status !== 0) {
    throw new Error(`Hook exited ${result.status} on mixed fragileFiles array`);
  }
  if (!result.stdout.includes('src/valid.ts')) {
    throw new Error('Valid fragileFiles entry was not injected');
  }
  if (result.stdout.includes('bare string entry') || result.stdout.includes('missing-reason') || result.stdout.includes('missing path')) {
    throw new Error('Invalid fragileFiles entry leaked into output');
  }
}));

// Report
let failures = 0;
for (const [ok, msg] of checks) {
  console.log(ok ? `  ok  ${msg}` : `  FAIL  ${msg}`);
  if (!ok) failures += 1;
}

if (failures > 0) {
  console.log(`\n${failures} of ${checks.length} checks failed`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} checks passed`);
process.exit(0);
