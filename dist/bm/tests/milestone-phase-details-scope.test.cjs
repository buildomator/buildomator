'use strict';

// Regression test for the #730 adaptation (multi-milestone Phase Details scope).
//
// A multi-milestone ROADMAP.md puts each milestone's `### Phase N:` detail
// headers in a separate `## Milestone vX.Y ... (Phase Details)` section that
// sits AFTER the primary milestone window. extractCurrentMilestone() must pull
// the CURRENT milestone's own (Phase Details) section into its slice, anchored
// boundary-aware to the milestone's exact version token, or every phase of any
// milestone after the first is invisible to phase-op / plan-phase / validate
// until a .planning/phases/<N>/ dir already exists. Upstream gsd-core #730.

const fs = require('fs');
const os = require('os');
const path = require('path');

const core = require(path.resolve(__dirname, '..', 'bin', 'lib', 'core.cjs'));

const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

function withTmpState(milestone, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-m730-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), `---\nmilestone: ${milestone}\n---\n`);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ─── Two-milestone roadmap; current = v1.1 (the second milestone) ────────────
const TWO_MILESTONE = `# Roadmap: Example

## Phases

- [x] **Phase 1: Setup** - initial scaffold

### Milestone v1.1 - Second milestone (added 2026-01-01)

- [x] **Phase 2: Feature** - the new thing

## Phase Details

### Phase 1: Setup
**Goal:** scaffold the app.

## Milestone v1.1 - Second milestone (Phase Details)

### Phase 2: Feature
**Goal:** build the new thing.
`;

withTmpState('v1.1', (cwd) => {
  const out = core.extractCurrentMilestone(TWO_MILESTONE, cwd);
  // THE BUG: phase 2's detail header lives under "## Milestone v1.1 ... (Phase
  // Details)" which the primary window stops before. Must be included now.
  ok('current-milestone phase detail (### Phase 2: Feature) is in scope', /###\s*Phase 2:\s*Feature/.test(out));
  ok('current-milestone phase 2 Goal body is in scope', /build the new thing/.test(out));
  // No regression: a first-milestone phase under the flat "## Phase Details"
  // section is still visible.
  ok('first-milestone phase detail (### Phase 1: Setup) still in scope', /###\s*Phase 1:\s*Setup/.test(out));
});

// ─── Three-milestone roadmap; current = v1.2 (latest) ────────────────────────
const THREE_MILESTONE = `# Roadmap: Example

## Phases

- [x] **Phase 1: Setup** - scaffold

### Milestone v1.1 - Second (added 2026-02-01)

- [x] **Phase 2: Feature** - thing two

### Milestone v1.2 - Third (added 2026-03-01)

- [ ] **Phase 3: Polish** - thing three

## Phase Details

### Phase 1: Setup
**Goal:** scaffold.

## Milestone v1.1 - Second (Phase Details)

### Phase 2: Feature
**Goal:** thing two.

## Milestone v1.2 - Third (Phase Details)

### Phase 3: Polish
**Goal:** thing three.
`;

withTmpState('v1.2', (cwd) => {
  const out = core.extractCurrentMilestone(THREE_MILESTONE, cwd);
  ok('latest-milestone phase detail (### Phase 3: Polish) is in scope', /###\s*Phase 3:\s*Polish/.test(out));
  ok('latest-milestone phase 3 Goal body is in scope', /\*\*Goal:\*\*\s*thing three/.test(out));
});

// ─── No regression: single-milestone roadmap unchanged ───────────────────────
const SINGLE = `# Roadmap: Example

## Phases

- [ ] **Phase 1: Setup** - scaffold

## Phase Details

### Phase 1: Setup
**Goal:** scaffold.
`;
withTmpState('v1.0', (cwd) => {
  // version v1.0 has no matching milestone heading -> stripShippedMilestones path;
  // the point is only that it does not throw and still surfaces phase 1.
  const out = core.extractCurrentMilestone(SINGLE, cwd);
  ok('single-milestone roadmap still surfaces its phase detail', /###\s*Phase 1:\s*Setup/.test(out));
});

for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
