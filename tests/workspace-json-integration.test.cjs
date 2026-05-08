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

function runHook(cwd, source) {
  const result = spawnSync('node', [HOOK_BIN, 'hook', 'session-start'], {
    cwd,
    encoding: 'utf-8',
    timeout: 5000,
    input: JSON.stringify({ source: source || 'startup' }),
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
    version: '0.1',
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
    version: '0.1',
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
    version: '0.1',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/canonical.ts': { fragility: 0.91, aiModificationCount: 5, humanModificationCount: 1 },
      },
    },
  });
  writeLegacyWorkspaceJson(dir, {
    version: '0.1',
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
    version: '0.1',
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
    version: '0.1',
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
    version: '0.1',
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
    version: '0.1',
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

// Test 10: HANDOFF.json and workspace.json coexist — both appear in the same output
check('HANDOFF.json and workspace.json both inject into the same output', () => withTempRepo(dir => {
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
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/coexist.ts': { fragility: 0.88, aiModificationCount: 4, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('Phase 4')) {
    throw new Error('HANDOFF.json injection regressed');
  }
  if (!result.stdout.includes('src/coexist.ts')) {
    throw new Error('workspace.json injection missing when HANDOFF also present');
  }
}));

// Test 11: DEFAULT_MAX_FILES cap enforced — 8 files above threshold, only top 5 (by fragility) in output
check('DEFAULT_MAX_FILES cap is enforced (8 files in, top 5 by fragility out)', () => withTempRepo(dir => {
  const fileIndex = {};
  for (let i = 1; i <= 8; i++) {
    fileIndex[`src/file${i}.ts`] = {
      fragility: 0.70 + (i * 0.01),
      aiModificationCount: i,
      humanModificationCount: 1,
    };
  }
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
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
  // Top 5 by fragility are file8..file4; file1..file3 must be excluded
  if (!result.stdout.includes('src/file8.ts')) {
    throw new Error('Highest-fragility file (file8) not included — sort order wrong');
  }
  if (result.stdout.includes('src/file1.ts')) {
    throw new Error('Lowest-fragility file (file1) should be excluded by cap');
  }
}));

// Test 12: fragility boundary at exactly 0.7 is included (spec: >= 0.7)
check('file at exactly 0.7 fragility is included (boundary condition)', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/boundary.ts': { fragility: 0.7, aiModificationCount: 3, humanModificationCount: 1 },
        'src/below.ts': { fragility: 0.699, aiModificationCount: 3, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/boundary.ts')) {
    throw new Error('File at exactly 0.7 fragility should be included (>= threshold)');
  }
  if (result.stdout.includes('src/below.ts')) {
    throw new Error('File below 0.7 fragility should be excluded');
  }
}));

// Test 13: mixed manual.fragileFiles — valid entries inject, invalid entries are skipped
check('mixed manual.fragileFiles skips invalid entries without crashing', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
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

// Test 14: source 'compact' also triggers injection (supported alongside 'startup')
check('source compact triggers workspace.json injection', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/compact-test.ts': { fragility: 0.82, aiModificationCount: 3, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir, 'compact');
  if (!result.stdout.includes('src/compact-test.ts')) {
    throw new Error('source=compact did not trigger workspace.json injection');
  }
}));

// Test 15: non-startup/compact source does not inject workspace.json context
check('source other-than-startup/compact produces no workspace.json injection', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/should-not-appear.ts': { fragility: 0.9, aiModificationCount: 5, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir, 'post-tool');
  if (result.stdout.includes('src/should-not-appear.ts')) {
    throw new Error('Workspace injection fired for unsupported source type');
  }
}));

// Test 16: non-object root JSON (array) exits 0 and produces no injection
check('array root JSON exits 0 and produces no injection', () => withTempRepo(dir => {
  fs.writeFileSync(path.join(dir, '.agents', 'agents.workspace.json'), '[1, 2, 3]');
  const result = runHook(dir);
  if (result.status !== 0) {
    throw new Error(`Hook exited ${result.status} on array root JSON`);
  }
  if (result.stdout.includes('workspace.json')) {
    throw new Error('Array root JSON should produce no workspace context');
  }
  if (!result.stderr.includes('not a JSON object')) {
    throw new Error('Expected "not a JSON object" diagnostic in stderr');
  }
}));

// Test 17: unsupported major version refuses to load with a clear error
check('unsupported major version refuses to load', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '99.0',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/future-version.ts': { fragility: 0.85, aiModificationCount: 3, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir);
  if (result.status !== 0) {
    throw new Error(`Hook exited ${result.status} on unsupported major version`);
  }
  if (!result.stderr.includes('Update gsd-plugin or regenerate')) {
    throw new Error('Expected clear refusal message in stderr');
  }
  if (result.stdout.includes('src/future-version.ts')) {
    throw new Error('Should refuse to inject for unsupported major version');
  }
}));

// Test 17b: same major, higher minor version loads successfully (forward-compat within major)
check('same major different minor version loads successfully', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.5',
    generated: {
      version: '1.0',
      fileIndex: {
        'src/minor-compat.ts': { fragility: 0.82, aiModificationCount: 2, humanModificationCount: 1 },
      },
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/minor-compat.ts')) {
    throw new Error('Same-major different-minor version should load (forward-compat within major)');
  }
}));

// Test 18: framework confidence boundary at exactly 0.7 is included (>= threshold)
check('framework at exactly 0.7 confidence is included (boundary condition)', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    generated: {
      version: '1.0',
      frameworkManifest: [
        { name: 'react', version: '18.0', confidence: 0.7 },
        { name: 'too-uncertain', version: '1.0', confidence: 0.699 },
      ],
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('react@18.0')) {
    throw new Error('Framework at exactly 0.7 confidence should be included (>= threshold)');
  }
  if (result.stdout.includes('too-uncertain')) {
    throw new Error('Framework below 0.7 confidence should be excluded');
  }
}));

// Test 19: coChangePatterns without note field renders just file paths (no parenthetical)
check('coChangePatterns without note renders files only', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    manual: {
      coChangePatterns: [
        { files: ['src/schema.ts', 'src/api.ts'] },
      ],
    },
  });
  const result = runHook(dir);
  if (!result.stdout.includes('src/schema.ts')) {
    throw new Error('coChangePattern without note should still inject file paths');
  }
  if (result.stdout.includes('undefined') || result.stdout.includes('null')) {
    throw new Error('Missing note field produced garbage in output');
  }
}));

// Test 20: mixed invalid coChangePatterns entries are skipped, valid ones inject
check('mixed invalid coChangePatterns skips invalid entries without crashing', () => withTempRepo(dir => {
  writeCanonicalWorkspaceJson(dir, {
    version: '0.1',
    manual: {
      coChangePatterns: [
        { files: ['src/valid-a.ts', 'src/valid-b.ts'], note: 'Must change together.' },
        null,
        'bare string',
        { files: [] },
        { note: 'no files array' },
      ],
    },
  });
  const result = runHook(dir);
  if (result.status !== 0) {
    throw new Error(`Hook exited ${result.status} on mixed coChangePatterns`);
  }
  if (!result.stdout.includes('src/valid-a.ts')) {
    throw new Error('Valid coChangePattern was not injected');
  }
  if (result.stdout.includes('bare string') || result.stdout.includes('no files array')) {
    throw new Error('Invalid coChangePattern entry leaked into output');
  }
}));

// Test 22: gsd.workspace_json_max_files config key overrides DEFAULT_MAX_FILES
check('gsd.workspace_json_max_files config key is respected', () => withTempRepo(dir => {
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.planning', 'config.json'),
    JSON.stringify({ 'gsd.workspace_json_max_files': 2 })
  );
  const fileIndex = {};
  for (let i = 1; i <= 5; i++) {
    fileIndex[`src/cfg${i}.ts`] = { fragility: 0.70 + (i * 0.01), aiModificationCount: i, humanModificationCount: 1 };
  }
  writeCanonicalWorkspaceJson(dir, { version: '0.1', generated: { version: '1.0', fileIndex } });
  const result = runHook(dir);
  let injectedCount = 0;
  for (let i = 1; i <= 5; i++) {
    if (result.stdout.includes(`src/cfg${i}.ts`)) injectedCount += 1;
  }
  if (injectedCount !== 2) {
    throw new Error(`Expected 2 files (config override), got ${injectedCount}`);
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
