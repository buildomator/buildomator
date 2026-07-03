#!/usr/bin/env node
/**
 * File-Layout Drift Detector
 *
 * Scans plugin content for `@~/.claude/get-shit-done/<subpath>` and
 * `@$HOME/.claude/get-shit-done/<subpath>` references. Classifies each:
 *   - Category A: plugin has `<subpath>` locally (repairable via path rewrite)
 *   - Category B: plugin doesn't have `<subpath>` (genuinely missing)
 *
 * Compares counts to tests/drift-baseline.json. Exits 0 if at-or-below
 * baseline, 1 if regressed, 2 on environment errors.
 *
 * Usage (from repo root):
 *   node bin/maintenance/check-file-layout.cjs              # compare to baseline
 *   node bin/maintenance/check-file-layout.cjs --dry        # preview only, no comparison
 *   node bin/maintenance/check-file-layout.cjs --write-baseline  # regenerate baseline
 *
 * Context: Phase 7 of v1.2 Upstream Resilience. Pattern-matches
 * bin/maintenance/rewrite-command-namespace.cjs for its skeleton (skip list,
 * text-extension filter, git-ls-files walk). Phase 9 will extract the shared
 * helper — do not extract prematurely.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const WRITE_BASELINE = args.includes('--write-baseline');

// Must run from repo root — uses git ls-files and resolves paths relative to cwd.
if (!fs.existsSync('.git') || !fs.existsSync('skills')) {
  console.error('error: run from repo root (expected .git/ and skills/)');
  process.exit(2);
}

// Skip list.
// Note: this differs from bin/maintenance/rewrite-command-namespace.cjs intentionally.
// That script rewrites command-name references inside planning prose (where the user
// might type them), so it only skips historical archives. The file-layout detector's
// concern is the PLUGIN'S file layout — planning docs are project paperwork, never
// shipped. They can (and do) legitimately embed example dangling-ref strings as
// regression-test inputs or documentation of past drift incidents, which would
// otherwise pollute the scan. Skip all of .planning/ and _research/ wholesale.
const skipDirs = [
  /^_research\//,
  /^\.planning\//,  // all planning artifacts (plans, summaries, research, quick tasks, archives)
  /^sdk\//,         // vendored SDK source/dist (v2.42.0+) — refs inside are upstream's docstrings
                    // (e.g. literal `references/foo.md` placeholders in prompt-sanitizer comments),
                    // not plugin-authored content the layout detector is meant to police.
  /^dist\//,        // generated packages (dist/bm, Phase 12): a byte copy of the already-scanned
                    // source, so scanning it double-counts every ref and drags in the same sdk/
                    // upstream-docstring placeholders under dist/bm/sdk/. The build's own --check
                    // guards dist/ integrity; the layout detector only polices authored source.
];
const textExt = /\.(md|json|cjs|js|ts|tsx|txt|yml|yaml|sh|html)$/i;

// Reference forms scanned. Three patterns:
//   1. `@~/.claude/get-shit-done/<subpath>` — legacy non-plugin install path. Most refs in
//      historical SKILL.md content. Dangle for plugin users (legacy dir absent).
//   2. `@$HOME/.claude/get-shit-done/<subpath>` — alternate env-var form of the same.
//   3. `@${CLAUDE_PLUGIN_ROOT}/<subpath>` — plugin-local form (added 2026-04-25). CC's plugin
//      loader substitutes ${CLAUDE_PLUGIN_ROOT} for skill/agent content, so this resolves to
//      the version-stamped install dir. Detector validates the <subpath> exists in plugin tree.
const REF_PATTERNS = [
  /@[~]\/\.claude\/get-shit-done\/([^\s'"\\)]+)/g,
  /@\$HOME\/\.claude\/get-shit-done\/([^\s'"\\)]+)/g,
  /@\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s'"\\)]+)/g,
];

// Normalize a captured subpath: strip trailing markdown punctuation (backticks, asterisks,
// brackets, commas, semicolons, colons, exclamation/question marks, trailing periods).
// This keeps the detector focused on real path references and avoids doc-prose artifacts
// like `...references/foo.md**` or `...workflows/bar.md\`.` inflating the counts.
function normalizeSubpath(s) {
  return s.replace(/[`*\],.;:!?]+$/, '');
}

// Decide whether a normalized subpath is a real reference (not a doc-prose placeholder).
// Rejects `{name}.md`-style literal placeholders and captures without a file extension.
function isRealRef(s) {
  if (!s) return false;
  if (/[{}<>]/.test(s)) return false;        // placeholders like {name}.md or <subpath>
  if (!/\.[a-zA-Z0-9]+$/.test(s)) return false; // must end in a real extension
  return true;
}

function scanFiles() {
  const allFiles = execSync('git ls-files', { encoding: 'utf-8' }).trim().split('\n');
  const included = allFiles.filter(f => {
    if (!textExt.test(f)) return false;
    if (skipDirs.some(re => re.test(f))) return false;
    return fs.existsSync(f);
  });

  const refs = new Set();          // unique subpaths referenced
  const refsWithLocations = [];    // for verbose report
  for (const file of included) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const re of REF_PATTERNS) {
      // Reset regex state (shared global regex across files)
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        const subpath = normalizeSubpath(m[1]);
        if (!isRealRef(subpath)) continue;
        refs.add(subpath);
        refsWithLocations.push({ file, subpath });
      }
    }
  }
  return { scannedCount: included.length, refs, refsWithLocations };
}

function classify(refs) {
  let hasPluginCounterpart = 0;
  let genuinelyMissing = 0;
  const missingExamples = [];
  const repairableExamples = [];
  for (const subpath of refs) {
    if (fs.existsSync(subpath)) {
      hasPluginCounterpart++;
      if (repairableExamples.length < 5) repairableExamples.push(subpath);
    } else {
      genuinelyMissing++;
      if (missingExamples.length < 5) missingExamples.push(subpath);
    }
  }
  return {
    total_dangling: refs.size,
    has_plugin_counterpart: hasPluginCounterpart,
    genuinely_missing: genuinelyMissing,
    missingExamples,
    repairableExamples,
  };
}

function readBaseline() {
  const p = 'tests/drift-baseline.json';
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (err) {
    console.error('error: could not parse tests/drift-baseline.json:', err.message);
    process.exit(2);
  }
}

function writeBaseline(counts) {
  const payload = {
    file_layout: {
      total_dangling: counts.total_dangling,
      has_plugin_counterpart: counts.has_plugin_counterpart,
      genuinely_missing: counts.genuinely_missing,
      generated_at: new Date().toISOString().slice(0, 10),
      note: 'Counts-based ratchet per Phase 7 CONTEXT D-07. Regenerate with --write-baseline when drift is legitimately reduced.'
    }
  };
  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync('tests/drift-baseline.json', JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log('Wrote tests/drift-baseline.json');
}

function report(scanned, counts, baseline) {
  console.log('File-layout drift detector');
  console.log('==========================');
  console.log('');
  console.log(`Scanned: ${scanned} plugin-tracked text files`);
  console.log('');
  console.log('Dangling refs found:');
  const bl = baseline && baseline.file_layout ? baseline.file_layout : null;
  const line = (label, current, baselineVal) => {
    const suffix = baselineVal === undefined ? '' : ` [baseline: ${baselineVal}]`;
    console.log(`  ${label.padEnd(52)} ${String(current).padStart(3)}${suffix}`);
  };
  line('Category A (repairable, has plugin counterpart):', counts.has_plugin_counterpart, bl ? bl.has_plugin_counterpart : undefined);
  line('Category B (genuinely missing):',                  counts.genuinely_missing,      bl ? bl.genuinely_missing : undefined);
  line('Total:',                                           counts.total_dangling,         bl ? bl.total_dangling : undefined);
  if (counts.missingExamples.length) {
    console.log('');
    console.log('Missing examples (first 5):');
    for (const ex of counts.missingExamples) console.log(`  - ${ex}`);
  }
}

function main() {
  const { scannedCount, refs } = scanFiles();
  const counts = classify(refs);

  if (WRITE_BASELINE) {
    report(scannedCount, counts, null);
    console.log('');
    writeBaseline(counts);
    return;
  }

  const baseline = readBaseline();
  report(scannedCount, counts, baseline);

  if (DRY || !baseline) {
    console.log('');
    console.log(DRY ? 'Dry-run mode — not comparing to baseline.' : 'No baseline found (run with --write-baseline).');
    return;
  }

  // Ratchet comparison
  const bl = baseline.file_layout;
  const regressions = [];
  if (counts.total_dangling > bl.total_dangling)
    regressions.push(`total_dangling ${counts.total_dangling} > ${bl.total_dangling}`);
  if (counts.has_plugin_counterpart > bl.has_plugin_counterpart)
    regressions.push(`has_plugin_counterpart ${counts.has_plugin_counterpart} > ${bl.has_plugin_counterpart}`);
  if (counts.genuinely_missing > bl.genuinely_missing)
    regressions.push(`genuinely_missing ${counts.genuinely_missing} > ${bl.genuinely_missing}`);

  console.log('');
  if (regressions.length) {
    console.log('Status: FAIL — drift regressed beyond baseline');
    for (const r of regressions) console.log(`  ${r}`);
    console.log('');
    console.log('Fix the regression or (if the increase is intentional and reviewed) regenerate the baseline:');
    console.log('  node bin/maintenance/check-file-layout.cjs --write-baseline');
    process.exit(1);
  } else {
    const reduced = [];
    if (counts.total_dangling < bl.total_dangling) reduced.push('total_dangling');
    if (counts.has_plugin_counterpart < bl.has_plugin_counterpart) reduced.push('has_plugin_counterpart');
    if (counts.genuinely_missing < bl.genuinely_missing) reduced.push('genuinely_missing');
    if (reduced.length) {
      console.log(`Status: PASS — drift REDUCED in ${reduced.join(', ')}. Consider running --write-baseline to lock in the gain.`);
    } else {
      console.log('Status: PASS — no regression, baseline matches.');
    }
  }
}

main();
