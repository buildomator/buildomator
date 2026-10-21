#!/usr/bin/env node
/**
 * check-skill-conformance.cjs
 *
 * Loud-fail conformance gate over the plugin's own skills/<name>/SKILL.md files.
 * The name + description of every skill load at session startup, so this gate
 * defends against the startup token tax on three axes:
 *   1. a fixed total-skill-count ceiling with a warn band below it,
 *   2. a description-length ratchet (grow-fail against a committed baseline),
 *   3. a narrow hard-fail frontmatter subset: name, description, allowed-tools.
 * license, compatibility and metadata are reported as advisory lines only and
 * never change the exit code. Unknown frontmatter keys are tolerated: our
 * skills legitimately carry argument-hint, type, agent and model.
 *
 * Three modes:
 *   node bin/maintenance/check-skill-conformance.cjs                 compare to baseline
 *   node bin/maintenance/check-skill-conformance.cjs --dry           preview, no comparison
 *   node bin/maintenance/check-skill-conformance.cjs --write-baseline capture the baseline
 *   node bin/maintenance/check-skill-conformance.cjs --validate <dir> validate one standalone dir
 *
 * The count ceiling and warn band are fixed constants; the description cap
 * ratchets off the committed baseline. The baseline is regenerated only by
 * hand with --write-baseline, never in CI.
 *
 * Exit codes: 0 pass or warn / 1 hard fail or ratchet regression / 2 usage (wrong cwd).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { extractFrontmatter } = require('../lib/frontmatter.cjs');

const CEILING = 90;
const WARN_AT = 88;
const BASELINE_KEY = 'skill_conformance';
const SPEC_NAME_MAX = 64;
const SPEC_COMPATIBILITY_MAX = 500;

// A tool token starts with a letter, continues with word characters, '*' or
// '-', and may end with a parenthesised suffix. Accepts Read, Bash(git:*),
// mcp__context7__*, AskUserQuestion. Rejects tokens with internal whitespace.
const TOOL_TOKEN_RE = /^[A-Za-z][\w*-]*(\([^)]*\))?$/;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const WRITE_BASELINE = args.includes('--write-baseline');
const VALIDATE_IDX = args.indexOf('--validate');
const VALIDATE_DIR = VALIDATE_IDX !== -1 ? args[VALIDATE_IDX + 1] : null;

// List skills/<dir>/SKILL.md files. A dir with no SKILL.md drops out of the
// existsSync filter, so the count is SKILL.md files, not dirs.
function listSkillFiles() {
  return fs.readdirSync('skills', { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join('skills', d.name, 'SKILL.md'))
    .filter(p => fs.existsSync(p));
}

// Validate one parsed SKILL.md frontmatter object.
// Returns { hard: string[], advisory: string[], descriptionLength: number }.
function validateSkill(file, fm) {
  const hard = [];
  const advisory = [];

  const name = fm.name;
  const nameOk = typeof name === 'string' && name.trim() !== '';
  if (!nameOk) hard.push('name missing or empty');

  const description = fm.description;
  const descOk = typeof description === 'string' && description.trim() !== '';
  if (!descOk) hard.push('description missing or empty');
  const descriptionLength = typeof description === 'string' ? description.length : 0;

  if (Object.prototype.hasOwnProperty.call(fm, 'allowed-tools')) {
    const at = fm['allowed-tools'];
    if (Array.isArray(at)) {
      // An empty array is valid (skills/join-discord).
      const bad = at.some(item => typeof item !== 'string' || item.trim() === '' || !TOOL_TOKEN_RE.test(item.trim()));
      if (bad) hard.push('allowed-tools malformed');
    } else if (typeof at === 'string') {
      // Split on commas and whitespace, not spaces alone (the comma form
      // Read, Write would otherwise mis-tokenize into Read,).
      const tokens = at.split(/[,\s]+/).filter(Boolean);
      if (tokens.length === 0 || tokens.some(t => !TOOL_TOKEN_RE.test(t))) {
        hard.push('allowed-tools malformed');
      }
    } else {
      // The {} placeholder from a bare `allowed-tools:` key lands here.
      hard.push('allowed-tools malformed');
    }
  }

  if (nameOk) {
    const n = name.trim();
    const dir = path.basename(path.dirname(file));
    const charsetOk = /^[a-z0-9-]+$/.test(n)
      && !n.startsWith('-') && !n.endsWith('-')
      && !n.includes('--') && n.length <= SPEC_NAME_MAX;
    if (!charsetOk) advisory.push(`name charset or shape: ${n}`);
    if (n !== dir) advisory.push(`name differs from directory basename (${dir})`);
  }

  if (Object.prototype.hasOwnProperty.call(fm, 'license')) {
    const lic = fm.license;
    if (typeof lic !== 'string' || lic.trim() === '') advisory.push('license present but not a non-empty string');
  }
  if (Object.prototype.hasOwnProperty.call(fm, 'compatibility')) {
    const comp = fm.compatibility;
    if (typeof comp !== 'string' || comp.length > SPEC_COMPATIBILITY_MAX) {
      advisory.push('compatibility present but not a string or longer than the spec limit');
    }
  }
  if (Object.prototype.hasOwnProperty.call(fm, 'metadata')) {
    const md = fm.metadata;
    const okMap = md && typeof md === 'object' && !Array.isArray(md)
      && Object.values(md).every(v => typeof v === 'string');
    if (!okMap) advisory.push('metadata present but not a map of string values');
  }

  return { hard, advisory, descriptionLength };
}

function scanSkills() {
  const files = listSkillFiles();
  const hard = [];        // { file, finding }
  const advisories = [];  // "<file>: <text>"
  const descriptions = []; // { file, length }
  const optional = { license: 0, compatibility: 0, metadata: 0 };
  let maxLen = 0;
  let maxFile = '(none)';

  for (const file of files) {
    let fm;
    try {
      const content = fs.readFileSync(file, 'utf-8');
      fm = extractFrontmatter(content);
    } catch (err) {
      hard.push({ file, finding: `frontmatter unparseable: ${err.message}` });
      continue;
    }
    const res = validateSkill(file, fm);
    for (const h of res.hard) hard.push({ file, finding: h });
    for (const a of res.advisory) advisories.push(`${file}: ${a}`);
    descriptions.push({ file, length: res.descriptionLength });
    if (res.descriptionLength > maxLen) { maxLen = res.descriptionLength; maxFile = file; }
    if (Object.prototype.hasOwnProperty.call(fm, 'license')) optional.license++;
    if (Object.prototype.hasOwnProperty.call(fm, 'compatibility')) optional.compatibility++;
    if (Object.prototype.hasOwnProperty.call(fm, 'metadata')) optional.metadata++;
  }

  return { count: files.length, hard, advisories, descriptions, optional, maxLen, maxFile };
}

function readBaseline() {
  const p = 'tests/drift-baseline.json';
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// Set ONLY the skill_conformance key, preserving sibling sections.
function writeBaseline(payload) {
  const existing = readBaseline() || {};
  existing[BASELINE_KEY] = {
    ...payload,
    ceiling: CEILING,
    warn_at: WARN_AT,
    generated_at: new Date().toISOString().slice(0, 10),
    note:
      'SKILL.md conformance ratchet. The total-skill-count ceiling is fixed at ' +
      `${CEILING} with a warn band from ${WARN_AT}; the description length is a grow-fail ` +
      'ratchet off max_description_length. Regenerate only by hand with --write-baseline, ' +
      'never in CI. Removing or merging a skill is preferred over raising the ceiling.',
  };
  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync(
    'tests/drift-baseline.json',
    JSON.stringify(existing, null, 2) + '\n',
    'utf-8'
  );
  console.log('Wrote tests/drift-baseline.json (skill_conformance section).');
}

function report(scan, baseline) {
  const bl = baseline && baseline[BASELINE_KEY] ? baseline[BASELINE_KEY] : null;
  const blLen = bl && typeof bl.max_description_length === 'number' ? bl.max_description_length : null;
  console.log('SKILL.md conformance scan:');
  console.log(`  skills: ${scan.count} (ceiling ${CEILING}, warn at ${WARN_AT})`);
  console.log(`  max description length: ${scan.maxLen} (${scan.maxFile})  ${blLen === null ? '(no baseline)' : 'baseline ' + blLen}`);
  console.log(`  hard findings: ${scan.hard.length}`);
  for (const a of scan.advisories) console.log(`  advisory: ${a}`);
  console.log(`  advisory: optional spec fields present: license ${scan.optional.license}, compatibility ${scan.optional.compatibility}, metadata ${scan.optional.metadata}`);
}

function runValidate(dir) {
  const file = path.join(dir, 'SKILL.md');
  console.log('SKILL.md conformance scan:');
  console.log(`  validate: ${dir}`);
  if (!fs.existsSync(file)) {
    console.log(`  ${file}: SKILL.md not found`);
    console.log('Status: FAIL');
    process.exit(1);
  }
  let fm;
  try {
    fm = extractFrontmatter(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.log(`  ${file}: frontmatter unparseable: ${err.message}`);
    console.log('Status: FAIL');
    process.exit(1);
  }
  const res = validateSkill(file, fm);
  for (const a of res.advisory) console.log(`  advisory: ${file}: ${a}`);
  if (res.hard.length) {
    console.log(`  hard findings: ${res.hard.length}`);
    for (const h of res.hard) console.log(`  ${file}: ${h}`);
    console.log('Status: FAIL');
    process.exit(1);
  }
  console.log('Status: PASS');
}

function main() {
  if (VALIDATE_DIR) {
    runValidate(VALIDATE_DIR);
    return;
  }

  if (!fs.existsSync('.git') || !fs.existsSync('skills')) {
    console.error('error: run from repo root (expected .git/ and skills/)');
    process.exit(2);
  }

  const scan = scanSkills();

  // Structural regressions are independent of the baseline.
  const structural = [];
  if (scan.count > CEILING) structural.push(`skill_count ${scan.count} > ceiling ${CEILING}`);
  for (const h of scan.hard) structural.push(`${h.file}: ${h.finding}`);

  if (WRITE_BASELINE) {
    report(scan, null);
    console.log('');
    if (structural.length) {
      console.log('Status: FAIL, SKILL.md conformance regressed');
      for (const r of structural) console.log(`  ${r}`);
      process.exit(1);
    }
    writeBaseline({
      skill_count: scan.count,
      max_description_length: scan.maxLen,
      max_description_file: scan.maxFile,
    });
    return;
  }

  const baseline = readBaseline();
  report(scan, baseline);

  if (DRY) {
    console.log('');
    console.log('Dry-run mode, not comparing to baseline.');
    return;
  }

  if (structural.length) {
    console.log('');
    console.log('Status: FAIL, SKILL.md conformance regressed');
    for (const r of structural) console.log(`  ${r}`);
    console.log('');
    console.log('A missing or empty name or description, a malformed allowed-tools value, or');
    console.log(`a skill count above the fixed ceiling of ${CEILING} fails this gate.`);
    console.log('The count ceiling is fixed, so remove or merge a skill instead of raising it.');
    process.exit(1);
  }

  if (!baseline || !baseline[BASELINE_KEY]) {
    console.log('');
    console.log('No baseline found (run with --write-baseline).');
    return;
  }

  const bl = baseline[BASELINE_KEY];
  const regressions = [];
  for (const d of scan.descriptions) {
    if (d.length > bl.max_description_length) {
      regressions.push(`description length ${d.length} > baseline ${bl.max_description_length} (${d.file})`);
    }
  }

  console.log('');
  if (regressions.length) {
    console.log('Status: FAIL, SKILL.md conformance regressed');
    for (const r of regressions) console.log(`  ${r}`);
    console.log('');
    console.log('Shorten the description, or if the growth is intentional run:');
    console.log('  node bin/maintenance/check-skill-conformance.cjs --write-baseline');
    console.log('The count ceiling is fixed, so remove or merge a skill instead of raising it.');
    process.exit(1);
  }

  if (scan.count >= WARN_AT) {
    console.log(`WARN: skill count ${scan.count} is inside the headroom band (warn at ${WARN_AT}, ceiling ${CEILING}); adding skills past ${CEILING} fails this gate`);
  }

  if (scan.maxLen < bl.max_description_length) {
    console.log(`Status: PASS, max description length REDUCED to ${scan.maxLen} (baseline ${bl.max_description_length}). Consider running --write-baseline to lock in the gain.`);
  } else {
    console.log('Status: PASS, no regression, baseline matches.');
  }
}

module.exports = { validateSkill, listSkillFiles, CEILING, WARN_AT };

if (require.main === module) {
  main();
}
