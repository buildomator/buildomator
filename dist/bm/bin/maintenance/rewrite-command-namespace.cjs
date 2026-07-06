#!/usr/bin/env node
/**
 * Rewrite `/gsd-<skill>` → `/bm:<skill>` across tracked plugin content.
 *
 * Upstream GSD registers its commands without a plugin namespace, so its
 * skill bodies, agent prompts, and references use the dash form. Under this
 * plugin, commands are namespaced as `/bm:<skill>` and the dash form is
 * dead text ("Unknown command: /gsd-foo. Did you mean /bm:foo?"). Every
 * upstream sync reintroduces dash-style references — run this script after
 * each sync to normalize them.
 *
 * Usage (from repo root):
 *   node bin/maintenance/rewrite-command-namespace.cjs --dry     # preview
 *   node bin/maintenance/rewrite-command-namespace.cjs           # apply
 *
 * Algorithm:
 *   1. Enumerate skill names from `skills/<name>/SKILL.md` directories.
 *   2. Build regex with skill alternatives sorted longest-first. Use a
 *      negative lookbehind (?<![a-zA-Z0-9/]) so file-path contexts like
 *      `skills/resume-work/SKILL.md` are NOT rewritten — they're
 *      paths, not commands. A negative lookahead (?![a-z-]) blocks partial
 *      matches on longer skill names or adjacent hyphens.
 *   3. Walk `git ls-files`, apply to text files only, skip historical
 *      archives that should retain their dash-era references.
 *
 * Context: quick task 260420-cns did the initial 273-replacement sweep.
 * See `.planning/quick/260420-cns-command-colon-fix/PLAN.md` for scope
 * rationale and the list of excluded historical directories.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY = process.argv.includes('--dry');

// 1. Discover skill registry. Script assumes cwd is the repo root.
const skillsDir = path.join(process.cwd(), 'skills');
if (!fs.existsSync(skillsDir)) {
  console.error('error: no skills/ directory found — run from repo root');
  process.exit(2);
}
// Skill dirs are now `skills/<name>/` (no `gsd-` prefix) since the 2026-04-24
// rename that fixed the duplicated-prefix command-ID bug. Filter: any dir under
// skills/ that contains a SKILL.md is a skill. Bundled TS artifacts in
// skills/bundled/ + skills/*.ts are excluded by the SKILL.md-presence check.
const skills = fs.readdirSync(skillsDir)
  .filter(d => {
    const full = path.join(skillsDir, d);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
  })
  .sort((a, b) => b.length - a.length);

if (skills.length === 0) {
  console.error('error: no skill directories found under skills/ (expected <name>/SKILL.md layout)');
  process.exit(2);
}

// 2. Build regex. Lookbehind excludes path contexts; lookahead blocks partials.
const alt = skills.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const pattern = new RegExp(`(?<![a-zA-Z0-9/])/gsd-(${alt})(?![a-z-])`, 'g');

// 3. Collect tracked text files, skipping historical archives.
const allFiles = execSync('git ls-files', { encoding: 'utf-8' }).trim().split('\n');
const textExt = /\.(md|json|cjs|js|ts|tsx|txt|yml|yaml|sh|html)$/i;
const skipDirs = [
  /^_research\//,
  /^\.planning\/milestones\/v\d+\./,        // any archived milestone (v1.0-*, v1.1-phases/, v1.2-phases/, ...)
  /^\.planning\/phases\/04-/,               // kept for reference; Phase 04 was moved to v1.1-phases/ above
  /^\.planning\/quick\/2604(0[7-9]|1[0-8])-/, // pre-2026-04-19 quick tasks
  /^dist\//,                                // generated packages (dist/bm, Phase 12): a byte copy of the
                                            // authored source. Rewriting refs here would corrupt the
                                            // generated tree and break build-bm --check; the source is
                                            // rewritten in place and re-copied on the next build.
];
const included = allFiles.filter(f => {
  if (!textExt.test(f)) return false;
  if (skipDirs.some(re => re.test(f))) return false;
  return fs.existsSync(f);
});

// 4. Apply (or preview).
const hits = [];
let totalReplacements = 0;
for (const f of included) {
  const before = fs.readFileSync(f, 'utf-8');
  const matches = before.match(pattern);
  if (!matches) continue;
  const after = before.replace(pattern, (_, name) => `/bm:${name}`);
  hits.push({ file: f, count: matches.length });
  totalReplacements += matches.length;
  if (!DRY) fs.writeFileSync(f, after);
}

// 5. Report.
console.log(`${DRY ? '[DRY] ' : ''}Skill registry: ${skills.length} entries`);
console.log(`Files scanned: ${included.length}`);
console.log(`Files with hits: ${hits.length}`);
console.log(`Total replacements: ${totalReplacements}`);
if (hits.length > 0) {
  console.log('');
  hits.sort((a, b) => b.count - a.count);
  for (const h of hits) console.log(`  ${String(h.count).padStart(3)}  ${h.file}`);
}
