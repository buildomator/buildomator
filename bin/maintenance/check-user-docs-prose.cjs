#!/usr/bin/env node
/**
 * check-user-docs-prose.cjs
 *
 * Counts-based ratchet against AI-flavored slop in plugin-self user-facing
 * documentation (README.md, CHANGELOG.md). Mirrors the file-layout drift
 * detector pattern: capture current counts as baseline, fail when counts
 * grow on subsequent runs.
 *
 * Inspired by ASD-STE100 Simplified Technical English, but only the
 * machine-checkable subset. Semantic rules (rule-of-three triads, over-balanced
 * parallelism, tone) are NOT enforced here because they cannot be counted
 * reliably; this gate stays to exact, word-bounded, high-precision matches.
 *
 * Scope: PLUGIN SELF ONLY. This guards the plugin's own docs, not downstream
 * user-project docs. Downstream authors make their own style calls.
 *
 * Patterns flagged:
 *   - em_en_dash: em-dash (U+2014) or en-dash (U+2013) characters
 *   - marketing_words: filler words (seamless, robust, leverage, ensure,
 *     systematic, powerful, elevate, delve) and their obvious inflections
 *   - cliche_openers: six fixed throat-clearing phrases (e.g. "when it comes to")
 *
 * Fenced code blocks are stripped before scanning so example commands inside
 * ``` blocks do not pollute the ratchet. Inline `code spans` are NOT stripped
 * (they often appear in flowing prose).
 *
 * Usage:
 *   node bin/maintenance/check-user-docs-prose.cjs              # compare to baseline
 *   node bin/maintenance/check-user-docs-prose.cjs --dry        # preview only, no comparison
 *   node bin/maintenance/check-user-docs-prose.cjs --write-baseline  # regenerate baseline
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

// Build the non-ASCII code points at runtime so no literal em-dash (U+2014),
// en-dash (U+2013), or right single quote (U+2019) ever appears in this source.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const RSQUO = String.fromCharCode(0x2019);

const PATTERNS = {
  em_en_dash: new RegExp('[' + EM_DASH + EN_DASH + ']', 'g'),
  marketing_words:
    /\b(?:seamless(?:ly)?|robust(?:ly|ness)?|leverag(?:e|es|ed|ing)|ensur(?:e|es|ed|ing)|systematic(?:ally)?|powerful(?:ly)?|elevat(?:e|es|ed|ing)|delv(?:e|es|ed|ing))\b/gi,
  cliche_openers: new RegExp(
    "\\b(?:in today(?:'|" + RSQUO + ")s fast-paced world|in the world of|" +
      "when it comes to|at the end of the day|" +
      "it(?:'|" + RSQUO + ")s worth noting that|needless to say)\\b",
    'gi'
  ),
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
  existing.user_docs_prose = {
    ...aggregate,
    generated_at: new Date().toISOString().slice(0, 10),
    note:
      'Prose-slop ratchet over README.md + CHANGELOG.md. Fenced code blocks ' +
      'are stripped before scanning. The em_en_dash count includes historical ' +
      'CHANGELOG entries that are frozen in place rather than rewritten; the ' +
      'ratchet only fails on GROWTH. Regenerate with --write-baseline only ' +
      'after a deliberate cleanup lowers a count.',
  };
  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync(
    'tests/drift-baseline.json',
    JSON.stringify(existing, null, 2) + '\n',
    'utf-8'
  );
  console.log('Wrote tests/drift-baseline.json (user_docs_prose section).');
}

function report(perFile, aggregate, baseline) {
  console.log('user-docs prose scan:');
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
    const bl = baseline && baseline.user_docs_prose && typeof baseline.user_docs_prose[k] === 'number'
      ? baseline.user_docs_prose[k]
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

  if (!baseline || !baseline.user_docs_prose) {
    console.log('');
    console.log('No baseline found (run with --write-baseline).');
    return;
  }

  const bl = baseline.user_docs_prose;
  const regressions = [];
  for (const k of Object.keys(PATTERNS)) {
    if (aggregate[k] > (bl[k] ?? 0)) {
      regressions.push(`${k} ${aggregate[k]} > ${bl[k] ?? 0}`);
    }
  }

  console.log('');
  if (regressions.length) {
    console.log('Status: FAIL, prose slop count regressed beyond baseline');
    for (const r of regressions) console.log(`  ${r}`);
    console.log('');
    console.log('New prose slop appeared in plugin user-facing docs.');
    console.log('If the additions are intentional, accept them by regenerating the baseline:');
    console.log('  node bin/maintenance/check-user-docs-prose.cjs --write-baseline');
    console.log('');
    console.log('Otherwise, fix the offender (remove the dash, replace the filler word, drop the opener) and rerun.');
    process.exit(1);
  }

  const reduced = Object.keys(PATTERNS).filter(k => aggregate[k] < (bl[k] ?? 0));
  if (reduced.length) {
    console.log(`Status: PASS, prose slop REDUCED in ${reduced.join(', ')}. Consider running --write-baseline to lock in the gain.`);
  } else {
    console.log('Status: PASS, no regression, baseline matches.');
  }
}

main();
