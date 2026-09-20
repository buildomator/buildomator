#!/usr/bin/env node
'use strict';

// Regression guard: init progress must order phases decimal-aware. The old
// parseInt sort collapsed 7.2 and 7.10 to the same integer 7 and left them in
// readdir order, so 7.10 sorted ahead of 7.2 and became the reported next_phase.
// A decimal-aware comparator keeps 7 < 7.1 < 7.2 < 7.10 < 8 and reports 7.2 as
// the lowest pending phase.
//
// Zero-dep harness mirroring tests/progress-and-frontier.test.cjs. CI runs it
// via `node tests/decimal-phase-order-init.test.cjs`.

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

const ROADMAP = `# Roadmap

## Current Milestone

- [x] Phase 7: A
- [x] Phase 7.1: B
- [ ] Phase 7.2: C
- [ ] Phase 7.10: D
- [ ] Phase 8: E

### Phase 7: A
**Goal:** a
### Phase 7.1: B
**Goal:** b
### Phase 7.2: C
**Goal:** c
### Phase 7.10: D
**Goal:** d
### Phase 8: E
**Goal:** e
`;

// Normalize the padded/roadmap number spellings (07.2, 7.2) to a bare token.
const strip = (n) => String(n).replace(/^0+(?=\d)/, '');

check('init progress orders 7, 7.1, 7.2, 7.10, 8 and reports 7.2 as next_phase', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2h-decimal-'));
  try {
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), ROADMAP, 'utf-8');
    // Only the pending phases are scaffolded on disk; 7 and 7.1 are roadmap-only
    // and marked complete via their [x] checkboxes.
    for (const d of ['07.2-c', '07.10-d', '08-e']) {
      fs.mkdirSync(path.join(dir, '.planning', 'phases', d), { recursive: true });
    }
    const out = execFileSync(process.execPath, [GSD_TOOLS, 'init', 'progress'], {
      cwd: dir, encoding: 'utf-8',
    });
    const data = JSON.parse(out);
    const order = data.phases.map(p => strip(p.number));
    assert.deepStrictEqual(order, ['7', '7.1', '7.2', '7.10', '8'], `order ${JSON.stringify(order)}`);
    assert.ok(data.next_phase, 'next_phase present');
    assert.strictEqual(strip(data.next_phase.number), '7.2', `next_phase ${JSON.stringify(data.next_phase.number)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll decimal-phase-order-init tests passed');
