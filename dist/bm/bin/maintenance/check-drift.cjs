#!/usr/bin/env node
/**
 * Unified Drift Check (DRIFT-03)
 *
 * Umbrella orchestrator that spawns the per-category detectors:
 *   1. bin/maintenance/check-file-layout.cjs       (dangling @~/.claude/... refs)
 *   2. bin/maintenance/check-handoff-schema.cjs    (HANDOFF.json schema validation)
 *   3. bin/maintenance/rewrite-command-namespace.cjs --dry  (/gsd-<skill> → /gsd:<skill> drift)
 *   4. bin/maintenance/check-version-alignment.cjs (internal milestone vs product version)
 *
 * Aggregates exit codes and reports a consolidated PASS/FAIL. Intended for local
 * dev loops and post-upstream-sync verification. NOT added to CI — CI runs each
 * per-category detector as a separate job for fast-feedback granularity (see
 * .github/workflows/check-drift.yml).
 *
 * The upstream-schema detector (see bin/maintenance/) is deliberately NOT included
 * here — it's network-dependent and post-sync-only; umbrella stays offline-
 * deterministic.
 *
 * Usage (from repo root):
 *   node bin/maintenance/check-drift.cjs
 *
 * Exit codes (maintenance-script convention):
 *   0 — all three children passed
 *   1 — any child failed (drift regression or schema violation)
 *   2 — orchestrator itself couldn't run (repo root issue, child binary missing)
 *
 * Context: Phase 9 of v1.2 Upstream Resilience.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (!fs.existsSync('.git') || !fs.existsSync('bin/maintenance')) {
  console.error('error: run from repo root (expected .git/ and bin/maintenance/)');
  process.exit(2);
}

const detectors = [
  {
    name: 'File-layout drift detector',
    cmd: 'node',
    args: ['bin/maintenance/check-file-layout.cjs'],
    parser: null,  // exit code is the whole story
  },
  {
    name: 'HANDOFF schema validator',
    cmd: 'node',
    args: ['bin/maintenance/check-handoff-schema.cjs'],
    parser: null,
  },
  {
    name: 'Namespace drift (dry-run)',
    cmd: 'node',
    args: ['bin/maintenance/rewrite-command-namespace.cjs', '--dry'],
    parser: (stdout) => {
      // Expected line form: "Total replacements: N"
      const match = stdout.match(/Total replacements:\s*(\d+)/);
      if (!match) return { ok: false, reason: 'could not parse "Total replacements" line' };
      const n = parseInt(match[1], 10);
      return n === 0
        ? { ok: true }
        : { ok: false, reason: `${n} dash-style command ref(s) need normalization — run "node bin/maintenance/rewrite-command-namespace.cjs" to fix` };
    },
  },
  {
    name: 'Version alignment (internal milestone vs product version)',
    cmd: 'node',
    args: ['bin/maintenance/check-version-alignment.cjs'],
    parser: null,  // exit code is the whole story (0 pass/skip, 1 divergence)
  },
];

function runDetector(i, total, det) {
  console.log(`\n[${i}/${total}] ${det.name}`);
  console.log(''.padEnd(Math.min(det.name.length + 20, 70), '-'));

  if (det.parser) {
    // Capture stdout for parsing, but still show it to the operator.
    const r = spawnSync(det.cmd, det.args, { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf-8' });
    if (r.error) {
      console.error(`  (spawn error: ${r.error.message})`);
      return { ok: false, reason: 'spawn failed', child_exit: null };
    }
    process.stdout.write(r.stdout || '');
    if (r.status !== 0) {
      return { ok: false, reason: `child exited ${r.status}`, child_exit: r.status };
    }
    const parsed = det.parser(r.stdout || '');
    return { ...parsed, child_exit: r.status };
  }

  // No parser — exit code decides.
  const r = spawnSync(det.cmd, det.args, { stdio: 'inherit' });
  if (r.error) {
    console.error(`  (spawn error: ${r.error.message})`);
    return { ok: false, reason: 'spawn failed', child_exit: null };
  }
  return { ok: r.status === 0, reason: r.status === 0 ? null : `child exited ${r.status}`, child_exit: r.status };
}

function main() {
  console.log('Unified drift check');
  console.log('===================');

  const results = [];
  for (let i = 0; i < detectors.length; i++) {
    results.push({
      name: detectors[i].name,
      ...runDetector(i + 1, detectors.length, detectors[i]),
    });
  }

  console.log('\nConsolidated summary');
  console.log('--------------------');
  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    const marker = r.ok ? 'PASS' : 'FAIL';
    const tail = r.ok ? '' : ` — ${r.reason}`;
    console.log(`  [${marker}] ${r.name}${tail}`);
  }
  if (failed.length === 0) {
    console.log(`\nStatus: PASS — all ${results.length} detectors clean`);
    process.exit(0);
  } else {
    console.log(`\nStatus: FAIL — ${failed.length}/${results.length} detector(s) reporting drift`);
    process.exit(1);
  }
}

main();
