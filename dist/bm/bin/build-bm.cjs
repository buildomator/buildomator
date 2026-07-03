#!/usr/bin/env node
/**
 * build-bm: generate the Buildomator (`bm`) plugin package from the authored
 * `gsd` source.
 *
 * The repo root IS the authored `gsd` plugin (marketplace source "./"). This
 * script copies the tracked source tree into dist/bm/, stamps ONLY the manifest
 * identity/branding fields (name gsd->bm, displayName/description -> Buildomator),
 * and single-sources the version from .claude-plugin/plugin.json so every
 * manifest site stays in lockstep. Every other file is byte-identical between the
 * two packages (D-02).
 *
 * Source list = `git ls-files` (TRACKED files only), filtered through
 * shouldExclude. Using the git index instead of an fs walk makes the build
 * deterministic across machines and guarantees untracked local files (secrets,
 * .env, scratch output) can never enter the committed, published package
 * (threat T-12-02).
 *
 * The root .claude-plugin/marketplace.json owns BOTH plugin entries, so a nested
 * copy inside dist/bm is skipped (RESEARCH A2). hooks/hooks.json is copied
 * verbatim including its hardcoded gsd cache fallback (RESEARCH A1): harmless
 * while both packages are byte-identical because the fallback runs identical
 * code, and the primary ${CLAUDE_PLUGIN_ROOT} path wins in normal operation. The
 * per-plugin fallback fix is deferred to Phase 13/14.
 *
 * Usage (from repo root):
 *   node bin/build-bm.cjs            build dist/bm and sync the marketplace versions
 *   node bin/build-bm.cjs --check    regenerate into a temp dir and diff against
 *                                    the committed dist/bm; exit 1 on any drift
 *
 * Exit codes (maintenance-script convention):
 *   0 - build succeeded, or --check found no drift
 *   1 - --check found drift (committed dist/bm differs from a fresh build)
 *   2 - ENV ERROR (not at repo root)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// First path segments that must NEVER enter the published package payload.
const EXCLUDE_ROOTS = new Set(['.git', '.planning', '.claude', 'node_modules', 'dist', 'scratchpad']);
// The root marketplace.json owns both plugin entries; a nested copy is skipped.
const EXCLUDE_EXACT = new Set(['.claude-plugin/marketplace.json']);

/**
 * Decide whether a repo-relative path is kept out of dist/bm.
 * Pure + exported so tests exercise it without disk I/O.
 */
function shouldExclude(relPath) {
  const norm = String(relPath).split(path.sep).join('/');
  if (EXCLUDE_EXACT.has(norm)) return true;
  const segments = norm.split('/');
  if (EXCLUDE_ROOTS.has(segments[0])) return true;
  // Any node_modules or .git segment at any depth.
  if (segments.includes('node_modules') || segments.includes('.git')) return true;
  // Any .DS_Store basename.
  if (segments[segments.length - 1] === '.DS_Store') return true;
  return false;
}

/**
 * Return a stamped copy of the authored manifest for the bm package.
 * Mutates ONLY name, displayName, description; every other key (version,
 * author, repository, license, keywords, mcpServers) is carried through
 * unchanged. The mcpServers key stays "gsd" per D-02 (byte-identical policy).
 * Does not mutate its input.
 */
function stampBmManifest(srcManifest) {
  const brandedDescription =
    'Buildomator -- ' + String(srcManifest.description || '').replace(/^Get Shit Done -- /, '');
  return {
    ...srcManifest,
    name: 'bm',
    displayName: 'Buildomator',
    description: brandedDescription,
    version: srcManifest.version,
  };
}

/** Repo root guard: require .git and .claude-plugin, else exit 2. */
function resolveRoot() {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, '.git')) || !fs.existsSync(path.join(root, '.claude-plugin'))) {
    console.error('error: run from repo root (expected .git and .claude-plugin/)');
    process.exit(2);
  }
  return root;
}

/** Tracked source files (git index), filtered through shouldExclude. */
function includedFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root });
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !shouldExclude(rel));
}

/** Copy the included tree into `outDir` and write the stamped bm manifest. */
function generate(root, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of includedFiles(root)) {
    const src = path.join(root, rel);
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  const srcManifest = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  const bmManifest = stampBmManifest(srcManifest);
  fs.writeFileSync(
    path.join(outDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify(bmManifest, null, 2) + '\n',
  );
  return srcManifest.version;
}

/**
 * Single-source the version (D-08): rewrite every marketplace.json plugins[]
 * entry's version to `version`, preserving all other fields and 2-space
 * formatting. Only writes when a version actually changed.
 */
function syncMarketplaceVersions(root, version) {
  const mpPath = path.join(root, '.claude-plugin', 'marketplace.json');
  const raw = fs.readFileSync(mpPath, 'utf8');
  const mp = JSON.parse(raw);
  let changed = false;
  if (Array.isArray(mp.plugins)) {
    for (const entry of mp.plugins) {
      if (entry && typeof entry.version === 'string' && entry.version !== version) {
        entry.version = version;
        changed = true;
      }
    }
  }
  if (changed) fs.writeFileSync(mpPath, JSON.stringify(mp, null, 2) + '\n');
  return changed;
}

/** Recursively list relative file paths under `dir`. */
function listFiles(dir) {
  const acc = [];
  function walk(d, prefix) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(d, ent.name), rel);
      else acc.push(rel);
    }
  }
  walk(dir, '');
  return acc;
}

/**
 * --check: regenerate into a fresh temp dir (NEVER rewriting the root
 * marketplace.json) and diff it against the committed dist/bm. Reports every
 * missing / extra / differing relative path. Exit 1 on any difference, else 0.
 * Additionally flags a marketplace entry whose version differs from plugin.json,
 * since check mode does not rewrite it.
 */
function check(root) {
  const committed = path.join(root, 'dist', 'bm');
  if (!fs.existsSync(committed)) {
    console.error('drift: committed dist/bm does not exist (run node bin/build-bm.cjs).');
    return 1;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-check-'));
  const problems = [];
  try {
    const version = generate(root, tmp);

    // marketplace parity (check mode never rewrites it).
    const mp = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
    if (Array.isArray(mp.plugins)) {
      for (const entry of mp.plugins) {
        if (entry && typeof entry.version === 'string' && entry.version !== version) {
          problems.push(`marketplace entry "${entry.name || '?'}" version ${entry.version} != plugin.json ${version}`);
        }
      }
    }

    const freshFiles = new Set(listFiles(tmp));
    const committedFiles = new Set(listFiles(committed));
    for (const rel of freshFiles) {
      if (!committedFiles.has(rel)) { problems.push(`missing from dist/bm: ${rel}`); continue; }
      const a = fs.readFileSync(path.join(tmp, rel));
      const b = fs.readFileSync(path.join(committed, rel));
      if (!a.equals(b)) problems.push(`differs: ${rel}`);
    }
    for (const rel of committedFiles) {
      if (!freshFiles.has(rel)) problems.push(`extra in dist/bm: ${rel}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (problems.length === 0) {
    console.log('bm drift check: PASS (committed dist/bm matches a fresh build).');
    return 0;
  }
  console.error('bm drift check: FAIL');
  for (const p of problems) console.error(`  ${p}`);
  return 1;
}

function main() {
  const root = resolveRoot();
  if (process.argv.includes('--check')) {
    process.exit(check(root));
  }
  const version = generate(root, path.join(root, 'dist', 'bm'));
  const changed = syncMarketplaceVersions(root, version);
  console.log(`built dist/bm (version ${version})${changed ? '; synced marketplace versions' : ''}.`);
}

// Export pure helpers for tests; run main only when invoked directly.
module.exports = { stampBmManifest, shouldExclude };
if (require.main === module) main();
