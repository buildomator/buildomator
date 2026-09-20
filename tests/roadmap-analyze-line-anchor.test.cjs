#!/usr/bin/env node
'use strict';

// Regression guard: roadmap analyze must only count real, line-start Phase
// headings. A `### Phase N:` inside a fenced code block, a blockquoted heading,
// or a mid-line prose mention must never inflate phase_count or appear as a
// phase; a fenced `- [ ] **Phase N: ...**` bullet must never be reported as a
// phase missing its detail section. Goal extraction for the real phases is
// unchanged because body slicing stays on the original (index-preserving mask).
//
// Zero-dep harness mirroring tests/letter-phase-ids.test.cjs. CI runs it via
// `node tests/roadmap-analyze-line-anchor.test.cjs`.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'bin', 'gsd-tools.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}: ${e.message}`); failures++; }
}

function makeProject(roadmap) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2h-analyze-anchor-'));
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmap, 'utf-8');
  return dir;
}

function analyze(dir) {
  const out = execFileSync(process.execPath, [GSD_TOOLS, 'roadmap', 'analyze'], {
    cwd: dir, encoding: 'utf-8',
  });
  return JSON.parse(out);
}

const ROADMAP = `# Roadmap

## Current Milestone

- [ ] **Phase 1: First**
- [ ] **Phase 2: Second**

### Phase 1: First

**Goal:** do first

Example block:

\`\`\`
### Phase 3: Fake
- [ ] **Phase 6: Fake**
\`\`\`

> ### Phase 4: Quoted

see ### Phase 5: inline mention

### Phase 2: Second

**Goal:** do second
`;

check('fenced, quoted, and prose Phase headings are not counted', () => {
  const dir = makeProject(ROADMAP);
  try {
    const d = analyze(dir);
    assert.strictEqual(d.phase_count, 2, `phase_count ${d.phase_count}`);
    const ids = d.phases.map(p => String(p.number)).sort();
    assert.deepStrictEqual(ids, ['1', '2'], `phases ${JSON.stringify(ids)}`);
    for (const bad of ['3', '4', '5']) {
      assert.ok(!ids.includes(bad), `phantom phase ${bad} counted`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('real-phase goal extraction is unchanged', () => {
  const dir = makeProject(ROADMAP);
  try {
    const d = analyze(dir);
    const byNum = Object.fromEntries(d.phases.map(p => [String(p.number), p]));
    assert.strictEqual(byNum['1'].goal, 'do first');
    assert.strictEqual(byNum['2'].goal, 'do second');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('a fenced checklist bullet is not reported as missing a detail section', () => {
  const dir = makeProject(ROADMAP);
  try {
    const d = analyze(dir);
    const missing = d.missing_phase_details || [];
    assert.ok(!missing.includes('6'), `fenced Phase 6 reported missing: ${JSON.stringify(missing)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll roadmap-analyze-line-anchor tests passed');
