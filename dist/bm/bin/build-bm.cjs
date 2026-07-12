#!/usr/bin/env node
/**
 * build-bm: generate the Buildomator (`bm`) plugin package from the authored
 * `gsd` source.
 *
 * The repo root IS the authored `gsd` plugin (marketplace source "./"). This
 * script copies the tracked source tree into dist/bm/ and applies one
 * deterministic transform so the copy is a self-consistent bm plugin:
 *   - the manifest identity/branding fields (name gsd->bm, displayName/description
 *     -> Buildomator) plus the mcpServers key (gsd -> bm) are stamped;
 *   - every bm: namespace prefix becomes bm: in every text file (slash commands,
 *     agent refs, frontmatter names), sparing gsd:// URIs and the files in
 *     COMMAND_REWRITE_EXCLUDE (mcp/server.cjs, CHANGELOG.md, the parity fixtures);
 *   - the hook cache-fallback plugin segment is stamped to bm in every text file
 *     except STAMP_EXCLUDE (the files that legitimately embed the gsd-form literal);
 *   - the version is single-sourced from .claude-plugin/plugin.json so every
 *     manifest site stays in lockstep.
 * Binary files and text files with no matching tokens are byte-identical copies.
 *
 * Source list = `git ls-files` (TRACKED files only), filtered through
 * shouldExclude. Using the git index instead of an fs walk makes the build
 * deterministic across machines and guarantees untracked local files (secrets,
 * .env, scratch output) can never enter the committed, published package
 * (threat T-12-02).
 *
 * The root .claude-plugin/marketplace.json owns BOTH plugin entries, so a nested
 * copy inside dist/bm is skipped. The transform lives inside generate() so the
 * --check regenerate-and-diff path runs identical logic and cannot silently pass
 * drifted output.
 *
 * Usage (from repo root):
 *   node bin/build-bm.cjs            build dist/bm and sync the marketplace versions
 *   node bin/build-bm.cjs --check    regenerate into a temp dir and diff against
 *                                    the committed dist/bm; exit 1 on any drift
 *
 * BM_DIST_DIR overrides the target tree for BOTH the build output and the --check
 * diff target, so an integration test can build into and diff against an isolated
 * copy and never mutate the committed dist/bm. An overridden build also skips the
 * root marketplace version sync (it must not touch shared repo files); a real
 * build (no override) writes dist/bm and syncs the marketplace versions.
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
const { rewriteCommandRefs, stampHookFallback, suppressNudge } = require('./lib/bm-transform.cjs');

// First path segments that must NEVER enter the published package payload.
const EXCLUDE_ROOTS = new Set(['.git', '.planning', '.claude', 'node_modules', 'dist', 'scratchpad']);
// The root marketplace.json owns both plugin entries; a nested copy is skipped.
const EXCLUDE_EXACT = new Set(['.claude-plugin/marketplace.json']);
// Text files receive the /bm: -> /bm: command-ref rewrite; every other file is
// copied verbatim. Extension set mirrors bin/maintenance/rewrite-command-namespace.cjs;
// extensionless files that open with a shebang (e.g. bin/gsd-resume-at) are text too.
const TEXT_EXT = /\.(md|json|cjs|js|ts|tsx|txt|yml|yaml|sh|html)$/i;
function isTextFile(rel, buf) {
  if (TEXT_EXT.test(rel)) return true;
  return buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21; // "#!"
}
// stampHookFallback is applied to EVERY text file except these. It is idempotent
// and a no-op on files without the cache/gsd-plugin/bm literal, so broad
// application is safe; the exclusions are the files that legitimately embed that
// FROM literal and would be corrupted (or have their meaning inverted) by the
// stamp. Every runtime carrier of the fallback therefore resolves to the bm cache
// dir (D-08 extends D-04 beyond the former hooks-only 3-file allowlist).
const STAMP_EXCLUDE = new Set([
  // The transform itself and its unit tests hardcode the gsd-form FROM literal.
  'bin/lib/bm-transform.cjs',
  'tests/bm-transform.test.cjs',
  'tests/build-bm-drift.test.cjs',
  'tests/bm-parity.test.cjs',
  // These carry the gsd-form cache literal as fixtures / expected values.
  'tests/context-monitor-hook-event.test.cjs',
  'tests/version-command.test.cjs',
  // Its install tripwire plants a gsd decoy on purpose.
  '.github/workflows/install-smoke.yml',
  // Historical release entries mention cache/gsd-plugin/bm; stamping would
  // revisionist-rewrite shipped history, so the changelog is preserved verbatim (IN-01).
  'CHANGELOG.md',
]);

// suppressNudge strips the sentinel-bracketed deprecation nudge from EVERY text
// file except these. It is idempotent and a no-op on files without the sentinel
// block, so broad application is safe; the exclusions are the files that embed
// the sentinel literals on purpose and would be self-corrupted by the strip.
const SUPPRESS_EXCLUDE = new Set([
  // Defines the strip and embeds both sentinel literals as string constants; a
  // strip of its own source would delete the transform between the literals.
  'bin/lib/bm-transform.cjs',
  // Asserts on the BM-NUDGE literal, so its dist/bm copy must keep it.
  'tests/nudge-emission.test.cjs',
]);

// Files whose bm: tokens must survive the command-ref rewrite. Each is excluded
// for a documented reason; every other text file gets rewriteCommandRefs.
const COMMAND_REWRITE_EXCLUDE = new Set([
  // Its only bm: tokens are MCP resource URIs, including the regex-escaped
  // bm:\/\/ at two match sites that the broadened bm:(?!/) rewrite would flip.
  // Skipping the rewrite here guarantees byte-identity (D-05) and loses nothing:
  // server.cjs has no command/agent self-refs.
  'mcp/server.cjs',
  // ~89 historical /bm: command mentions in shipped release notes; rewriting
  // would revisionist-rewrite them, so the bm changelog preserves history (IN-01).
  'CHANGELOG.md',
  // Houses the census positive-control fixtures (/bm:plan-phase, bm:gsd-executor,
  // the /bm[:-] literal) that must stay intact in the dist/bm copy for parity
  // consistency; without this exclusion the fixtures get flipped in the copy.
  'tests/bm-parity.test.cjs',
]);

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
 * Stamps the identity fields name, displayName, description, and rekeys the
 * single mcpServers entry from "gsd" to "bm" so each plugin registers a
 * distinctly-keyed server; the server config object itself is carried through
 * unchanged. Every other key (version, author, repository, license, keywords)
 * is preserved. Does not mutate its input.
 */
function stampBmManifest(srcManifest) {
  const stamped = {
    ...srcManifest,
    name: 'bm',
    displayName: 'Buildomator',
    description:
      'Buildomator -- structured workflow plugin for Claude Code with planning, ' +
      'execution, verification, and MCP-backed project state',
    version: srcManifest.version,
  };
  const servers = stamped.mcpServers;
  if (servers && servers.gsd && !servers.bm) {
    const { gsd, ...rest } = servers;
    stamped.mcpServers = { bm: gsd, ...rest };
  }
  return stamped;
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
    const buf = fs.readFileSync(src);
    if (isTextFile(rel, buf)) {
      let text = buf.toString('utf8');
      if (!COMMAND_REWRITE_EXCLUDE.has(rel)) text = rewriteCommandRefs(text);
      if (!STAMP_EXCLUDE.has(rel)) text = stampHookFallback(text);
      if (!SUPPRESS_EXCLUDE.has(rel)) text = suppressNudge(text);
      fs.writeFileSync(dest, text);
      // Preserve the source file mode (writeFileSync creates 0644 by default,
      // which would strip the executable bit from scripts and hooks).
      fs.chmodSync(dest, fs.statSync(src).mode & 0o777);
    } else {
      fs.copyFileSync(src, dest);
    }
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
 *
 * The diff target defaults to <root>/dist/bm but is overridable via BM_DIST_DIR
 * so an integration test can point --check at an isolated copy and tamper it
 * without ever mutating the shared committed tree. generate() always writes to
 * its own fresh temp; only the comparison target moves.
 */
function check(root) {
  const committed = process.env.BM_DIST_DIR || path.join(root, 'dist', 'bm');
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
  const outDir = process.env.BM_DIST_DIR || path.join(root, 'dist', 'bm');
  const version = generate(root, outDir);
  // Only sync the shared root marketplace for a real build of the committed
  // tree; an overridden (isolated) build must not mutate shared repo files.
  const changed = process.env.BM_DIST_DIR ? false : syncMarketplaceVersions(root, version);
  console.log(`built ${outDir} (version ${version})${changed ? '; synced marketplace versions' : ''}.`);
}

// Export pure helpers for tests; run main only when invoked directly.
module.exports = {
  stampBmManifest, shouldExclude, rewriteCommandRefs, stampHookFallback, suppressNudge, isTextFile,
  STAMP_EXCLUDE, SUPPRESS_EXCLUDE, COMMAND_REWRITE_EXCLUDE,
};
if (require.main === module) main();
