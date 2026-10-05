'use strict';

// Repo-wide no-vendoring guard for the craft-skill catalog.
//
// The catalog references external skills by metadata and pinned commit only; no
// third-party skill body, LICENSE text, or copied skill tree may enter the repo.
// The per-entry schema checks live in tests/craft-skill-catalog.test.cjs; this
// guard is the repo-level complement that survives future catalog edits:
//   1. sdk/shared holds exactly one craft-skill* file and it is the catalog JSON.
//   2. No file under sdk/shared, bin/lib, skills/ or references/ (other than the
//      catalog JSON) carries a third-party publisher/repo/license marker.
//   3. No directory named seo-audit or query exists under skills/, sdk/shared/
//      or references/ (a copied skill tree would land as such a directory).
//   4. Every catalog entry passes validateCraftSkillCatalog and no string field
//      exceeds MAX_STRING_LENGTH.
//   5. The catalog JSON has no line longer than 400 characters and no string
//      value beginning with '#' (no markdown headings smuggled in as data).
//
// Zero-dep harness: a bare ok(label, cond) runner, a failure counter, and a
// process.exit(1) footer.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cat = require(path.join(ROOT, 'bin', 'lib', 'craft-skill-catalog.cjs'));

const CATALOG_REL = 'sdk/shared/craft-skill-catalog.json';
const CATALOG_ABS = path.join(ROOT, 'sdk', 'shared', 'craft-skill-catalog.json');
const SCAN_ROOTS = ['sdk/shared', 'bin/lib', 'skills', 'references'];
const THIRD_PARTY_MARKERS = ['coreyhaines31', 'marketingskills', 'duckdb-skills', 'Stichting DuckDB'];
const COPIED_TREE_DIRS = ['seo-audit', 'query'];
const COPIED_TREE_ROOTS = ['skills', 'sdk/shared', 'references'];

const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

// Small recursive walker: returns repo-relative file paths, skipping
// node_modules and dotfiles/dotdirs.
function walk(relDir) {
  const out = [];
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const rel = `${relDir}/${ent.name}`;
    if (ent.isDirectory()) out.push(...walk(rel));
    else if (ent.isFile()) out.push(rel);
  }
  return out;
}

// --- 1. Exactly one craft-skill* file under sdk/shared, the catalog JSON ------
const craftFiles = fs.readdirSync(path.join(ROOT, 'sdk', 'shared')).filter((f) => f.startsWith('craft-skill'));
ok('sdk/shared holds exactly one craft-skill* file', craftFiles.length === 1);
ok('that one file is craft-skill-catalog.json', craftFiles[0] === 'craft-skill-catalog.json');

// --- 2. No third-party marker outside the catalog JSON ------------------------
let noThirdPartyText = true;
const offenders = [];
for (const root of SCAN_ROOTS) {
  for (const rel of walk(root)) {
    if (rel === CATALOG_REL) continue;
    let text;
    try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
    for (const marker of THIRD_PARTY_MARKERS) {
      if (text.includes(marker)) { noThirdPartyText = false; offenders.push(`${rel}:${marker}`); }
    }
  }
}
ok(`no third-party skill/license text outside the catalog (${offenders.join(', ') || 'clean'})`, noThirdPartyText);

// --- 3. No copied skill tree directory ---------------------------------------
let noCopiedTree = true;
for (const root of COPIED_TREE_ROOTS) {
  for (const name of COPIED_TREE_DIRS) {
    if (fs.existsSync(path.join(ROOT, root, name))) noCopiedTree = false;
  }
}
ok('no copied skill tree directory (seo-audit / query) under skills, sdk/shared or references', noCopiedTree);

// --- 4. Every entry validates; no string field over the cap ------------------
const verdict = cat.validateCraftSkillCatalog(cat.catalog);
ok('committed catalog validates', verdict.valid === true && verdict.errors.length === 0);

let noOversizeField = true;
for (const entry of Object.values(cat.catalog.skills)) {
  for (const v of Object.values(entry)) {
    if (typeof v === 'string' && v.length > cat.MAX_STRING_LENGTH) noOversizeField = false;
  }
}
ok(`no entry string field exceeds the ${cat.MAX_STRING_LENGTH}-char cap`, noOversizeField);

// --- 5. Catalog JSON line length + no smuggled markdown headings -------------
const rawText = fs.readFileSync(CATALOG_ABS, 'utf8');
const longestLine = rawText.split('\n').reduce((m, line) => Math.max(m, line.length), 0);
ok(`catalog JSON has no line longer than 400 characters (longest ${longestLine})`, longestLine <= 400);

function noHeadingString(value) {
  if (typeof value === 'string') return !value.startsWith('#');
  if (Array.isArray(value)) return value.every(noHeadingString);
  if (value && typeof value === 'object') return Object.values(value).every(noHeadingString);
  return true;
}
ok('no catalog string value begins with "#" (no smuggled markdown heading)', noHeadingString(JSON.parse(rawText)));

// --- Report ------------------------------------------------------------------
for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
