#!/usr/bin/env node
/**
 * Upstream HANDOFF Schema Drift Detector (SCHEMA-03)
 *
 * Compares upstream GSD's /gsd:pause-work declared HANDOFF.json fields
 * against the plugin's schema/handoff-v1.json. Exits 0 if upstream is a
 * subset of plugin's required+optional fields; 1 on drift; 2 on env error.
 *
 * Runs post-upstream-sync (NOT on every push, per Phase 8 CONTEXT D-10).
 * Intended use:
 *   UPSTREAM_VERSION=v1.38.3 node bin/maintenance/check-upstream-schema.cjs
 *
 * If UPSTREAM_VERSION is unset, the detector queries `gh release view` for
 * the latest upstream tag. If a cached extracted tarball is available at
 * `/tmp/gsd-sync-<clean-version>/gsd-core-<clean-version>/` (from a
 * prior sync), the detector uses it instead of re-downloading — cheap
 * optimization that lets offline post-sync checks work.
 *
 * Exit codes:
 *   0 — PASS (upstream field set is a subset of plugin schema)
 *   1 — DRIFT (upstream added a field we don't know about, OR plugin
 *              requires a field upstream doesn't declare)
 *   2 — ENV ERROR (gh unavailable + no cache, parse failed, etc.)
 *
 * Context: Phase 8 of v1.2 Upstream Resilience.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (!fs.existsSync('.git') || !fs.existsSync('schema/handoff-v1.json')) {
  console.error('error: run from repo root (expected .git/ and schema/handoff-v1.json)');
  process.exit(2);
}

function resolveUpstreamVersion() {
  if (process.env.UPSTREAM_VERSION) return process.env.UPSTREAM_VERSION;
  try {
    const out = execSync('gh release view --repo open-gsd/gsd-core --json tagName -q .tagName', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim();
  } catch (err) {
    console.error('error: could not resolve latest upstream version. Set UPSTREAM_VERSION or install gh CLI.');
    process.exit(2);
  }
}

function ensureUpstreamTarball(version) {
  // Cached tarball layout: /tmp/gsd-sync-<clean>/gsd-core-<clean>/
  // (Clean version has the leading 'v' stripped; established by past sync runs.)
  // GitHub source archives extract to <repo>-<clean>/, so the new upstream repo
  // open-gsd/gsd-core yields `gsd-core-<clean>/` (was `get-shit-done-<clean>/`).
  const clean = version.replace(/^v/, '');
  const workDir = path.join('/tmp', `gsd-sync-${clean}`);
  const cachedDir = path.join(workDir, `gsd-core-${clean}`);
  if (fs.existsSync(cachedDir)) {
    console.log('Using cached tarball at:', cachedDir);
    return cachedDir;
  }
  // Download via gh
  try {
    fs.mkdirSync(workDir, { recursive: true });
    execSync(
      `gh release download ${version} --repo open-gsd/gsd-core --archive=tar.gz -O upstream.tar.gz`,
      { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    execSync('tar xzf upstream.tar.gz', { cwd: workDir });
  } catch (err) {
    console.error(
      'error: failed to download/extract upstream',
      version,
      '—',
      err && err.message ? err.message : err
    );
    process.exit(2);
  }
  if (!fs.existsSync(cachedDir)) {
    console.error('error: expected extract dir not found at', cachedDir);
    process.exit(2);
  }
  return cachedDir;
}

function extractUpstreamFields(workflowPath) {
  const raw = fs.readFileSync(workflowPath, 'utf-8');
  // Find the write_structured step
  const stepMatch = raw.match(/<step name="write_structured">[\s\S]*?<\/step>/);
  if (!stepMatch) {
    console.error('error: could not find <step name="write_structured"> in', workflowPath);
    process.exit(2);
  }
  const jsonBlockMatch = stepMatch[0].match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonBlockMatch) {
    console.error('error: could not find fenced json block in write_structured step');
    process.exit(2);
  }
  // Replace {placeholders} with JSON-valid values so JSON.parse succeeds.
  //
  // Placeholder content is always `[a-zA-Z0-9_ ,]+` (identifiers, spaces,
  // commas — never quotes, colons, or braces). That constraint lets us
  // distinguish placeholders from nested JSON objects like
  // `{"id": 1, "name": "..."}` which contain quotes + colons. Matching
  // `{[^}]*}` (as the CONTEXT stub suggested) is broken — it greedily eats
  // from the outer JSON's opening `{` straight through to the first `}`
  // inside the first placeholder, destroying the top-level object shape.
  //
  // Two passes:
  //   1. Quoted placeholders `"{...}"` → `"placeholder"` (drop outer quotes
  //      to avoid `""placeholder""`, which is invalid JSON).
  //   2. Unquoted placeholders `{...}` → numeric `0` (they appear where
  //      upstream uses unquoted numbers: `"plan": {current_plan_number}`).
  //
  // Finally strip trailing commas that JSON.parse rejects.
  let candidate = jsonBlockMatch[1]
    .replace(/"\{[a-zA-Z0-9_ ,]+\}"/g, '"placeholder"')
    .replace(/\{[a-zA-Z0-9_ ,]+\}/g, '0')
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    const parsed = JSON.parse(candidate);
    return Object.keys(parsed);
  } catch (err) {
    console.error(
      'error: could not parse upstream JSON after placeholder substitution —',
      err && err.message ? err.message : err
    );
    console.error('--- candidate ---');
    console.error(candidate);
    process.exit(2);
  }
}

function main() {
  const version = resolveUpstreamVersion();
  console.log('Upstream HANDOFF Schema Drift Detector');
  console.log('======================================');
  console.log('');
  console.log('Target version:', version);
  const upstreamDir = ensureUpstreamTarball(version);
  const workflowPath = path.join(upstreamDir, 'gsd-core', 'workflows', 'pause-work.md');
  if (!fs.existsSync(workflowPath)) {
    console.error('error: workflow file not found at', workflowPath);
    process.exit(2);
  }
  const upstreamFields = extractUpstreamFields(workflowPath);
  console.log('Upstream fields:', upstreamFields.length, '→', upstreamFields.join(', '));

  const schema = JSON.parse(fs.readFileSync('schema/handoff-v1.json', 'utf-8'));
  const pluginRequired = schema.required || [];
  const pluginAll = Object.keys(schema.properties || {});
  console.log('Plugin required:', pluginRequired.length, '→', pluginRequired.join(', '));
  console.log('Plugin total:', pluginAll.length);
  console.log('');

  const newInUpstream = upstreamFields.filter((f) => !pluginAll.includes(f));
  const missingFromUpstream = pluginRequired.filter((f) => !upstreamFields.includes(f));

  let fail = false;
  if (newInUpstream.length) {
    console.log('FAIL: upstream has fields not in plugin schema:');
    for (const f of newInUpstream) console.log('  -', f);
    fail = true;
  }
  if (missingFromUpstream.length) {
    console.log('FAIL: plugin requires fields upstream does not declare:');
    for (const f of missingFromUpstream) console.log('  -', f);
    fail = true;
  }
  if (fail) {
    console.log('');
    console.log('Action: review upstream', version, 'pause-work.md. Either:');
    console.log('  - Update schema/handoff-v1.json to accommodate the new field(s)');
    console.log('  - Or mark newly-non-upstream required fields as optional');
    process.exit(1);
  }
  console.log('Status: PASS — upstream field set is a subset of plugin schema (no drift)');
  process.exit(0);
}

main();
