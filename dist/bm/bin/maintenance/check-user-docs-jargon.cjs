#!/usr/bin/env node
/**
 * check-user-docs-jargon.cjs
 *
 * Counts-based ratchet against GSD-jargon leaks in plugin-self user-facing
 * documentation (README.md, CHANGELOG.md). Mirrors the file-layout drift
 * detector pattern: capture current counts as baseline, fail when counts
 * grow on subsequent runs.
 *
 * Scope: PLUGIN SELF ONLY. This is for the plugin's own docs, not downstream
 * user-project docs. Downstream projects use phase numbers and plan IDs for
 * their own legitimate domain reasons. Policing them would be presumptuous.
 *
 * Patterns flagged:
 *   - planning_paths: `.planning/` references (very high confidence leak)
 *   - artifact_names: ROADMAP.md, STATE.md, SUMMARY.md, HANDOFF.json (medium-high)
 *   - plan_files: NN-NN-name-PLAN.md canonical plan file names
 *   - generic_phase_num: "phase N" in prose (medium)
 *
 * Fenced code blocks are stripped before scanning so `/bm:foo` examples and
 * file-path examples inside ``` blocks don't pollute the ratchet. Inline
 * `code spans` are NOT stripped (they often appear in flowing prose making
 * a leak claim).
 *
 * Usage:
 *   node bin/maintenance/check-user-docs-jargon.cjs              # compare to baseline
 *   node bin/maintenance/check-user-docs-jargon.cjs --dry        # preview only, no comparison
 *   node bin/maintenance/check-user-docs-jargon.cjs --write-baseline  # regenerate baseline
 *
 * Exit codes: 0 pass / 1 ratchet regression / 2 usage error.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const WRITE_BASELINE = args.includes('--write-baseline');

if (!fs.existsSync('.git') || !fs.existsSync('skills')) {
  console.error('error: run from repo root (expected .git/ and skills/)');
  process.exit(2);
}

const TARGETS = ['README.md', 'CHANGELOG.md'];

const PATTERNS = {
  planning_paths: /\.planning\//g,
  artifact_names: /\b(ROADMAP|STATE|SUMMARY)\.md\b|\bHANDOFF\.json\b/g,
  plan_files: /\b\d+[A-Z]?-\d+(-[a-z][a-z0-9-]*)?-PLAN\.md\b/g,
  generic_phase_num: /\bphase\s+\d+\b/gi,
};

function stripFencedCodeBlocks(content) {
  // Strip ```lang ... ``` and ``` ... ``` blocks. The non-greedy match
  // handles consecutive blocks correctly; the [\s\S] avoids the default
  // dot-no-newline gotcha.
  return content.replace(/```[\s\S]*?```/g, '');
}

function countMatches(content, pattern) {
  pattern.lastIndex = 0;
  return (content.match(pattern) || []).length;
}

function scanFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const stripped = stripFencedCodeBlocks(raw);
  const per = {};
  for (const [name, pat] of Object.entries(PATTERNS)) {
    per[name] = countMatches(stripped, pat);
  }
  return per;
}

function scanAll() {
  const perFile = {};
  const aggregate = Object.fromEntries(Object.keys(PATTERNS).map(k => [k, 0]));
  for (const file of TARGETS) {
    if (!fs.existsSync(file)) {
      perFile[file] = null;
      continue;
    }
    const counts = scanFile(file);
    perFile[file] = counts;
    for (const k of Object.keys(PATTERNS)) aggregate[k] += counts[k];
  }
  return { perFile, aggregate };
}

function readBaseline() {
  const p = 'tests/drift-baseline.json';
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return parsed;
  } catch {
    return null;
  }
}

function writeBaseline(aggregate) {
  const existing = readBaseline() || {};
  existing.user_docs_jargon = {
    ...aggregate,
    generated_at: new Date().toISOString().slice(0, 10),
    note:
      'Counts-based ratchet for GSD-jargon mentions in user-facing plugin docs ' +
      '(README.md, CHANGELOG.md). Fenced code blocks are stripped before scanning ' +
      'so /bm: examples and file-path examples inside ``` blocks do not pollute ' +
      'the ratchet. Regenerate with --write-baseline when a legitimate addition ' +
      'lands (e.g., a CHANGELOG entry describing internal work).',
  };
  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync(
    'tests/drift-baseline.json',
    JSON.stringify(existing, null, 2) + '\n',
    'utf-8'
  );
  console.log('Wrote tests/drift-baseline.json (user_docs_jargon section).');
}

function report(perFile, aggregate, baseline) {
  console.log('user-docs jargon scan:');
  console.log(`  scope: ${TARGETS.join(', ')}`);
  for (const file of TARGETS) {
    const counts = perFile[file];
    if (!counts) {
      console.log(`  ${file}: (missing)`);
      continue;
    }
    const parts = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('  ');
    console.log(`  ${file}: ${parts}`);
  }
  console.log('');
  console.log('aggregate:');
  for (const [k, v] of Object.entries(aggregate)) {
    const bl = baseline && baseline.user_docs_jargon && typeof baseline.user_docs_jargon[k] === 'number'
      ? baseline.user_docs_jargon[k]
      : undefined;
    const blStr = bl === undefined ? '(no baseline)' : `baseline ${bl}`;
    console.log(`  ${k.padEnd(20)} ${String(v).padStart(4)}  ${blStr}`);
  }
}

function main() {
  const { perFile, aggregate } = scanAll();

  if (WRITE_BASELINE) {
    report(perFile, aggregate, null);
    console.log('');
    writeBaseline(aggregate);
    return;
  }

  const baseline = readBaseline();
  report(perFile, aggregate, baseline);

  if (DRY) {
    console.log('');
    console.log('Dry-run mode, not comparing to baseline.');
    return;
  }

  if (!baseline || !baseline.user_docs_jargon) {
    console.log('');
    console.log('No baseline found (run with --write-baseline).');
    return;
  }

  const bl = baseline.user_docs_jargon;
  const regressions = [];
  for (const k of Object.keys(PATTERNS)) {
    if (aggregate[k] > (bl[k] ?? 0)) {
      regressions.push(`${k} ${aggregate[k]} > ${bl[k] ?? 0}`);
    }
  }

  console.log('');
  if (regressions.length) {
    console.log('Status: FAIL, jargon count regressed beyond baseline');
    for (const r of regressions) console.log(`  ${r}`);
    console.log('');
    console.log('New GSD-jargon mentions appeared in plugin user-facing docs.');
    console.log('If the additions are intentional (e.g., a CHANGELOG entry describing internal work),');
    console.log('accept them by regenerating the baseline:');
    console.log('  node bin/maintenance/check-user-docs-jargon.cjs --write-baseline');
    console.log('');
    console.log('Otherwise, remove the jargon mention(s) and rerun.');
    process.exit(1);
  }

  const reduced = Object.keys(PATTERNS).filter(k => aggregate[k] < (bl[k] ?? 0));
  if (reduced.length) {
    console.log(`Status: PASS, jargon REDUCED in ${reduced.join(', ')}. Consider running --write-baseline to lock in the gain.`);
  } else {
    console.log('Status: PASS, no regression, baseline matches.');
  }
}

main();
