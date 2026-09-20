'use strict';

// Regression test: workflow subagent spawns must use the plugin-namespaced
// agent id (bm:bm-<name>), not the bare form (bm-<name> / gsd-<name>).
//
// bm-<role> is the primary, sole spawnable agent name; the gsd- spelling is
// the 4.x backwards-compat form for config keys and CLI arguments only, and is
// resolved by name-normalization on both resolver twins (removed at v5.0).
//
// The plugin's plugin.json declares "name": "gsd", so Claude Code registers
// every agent under the `bm:` namespace (e.g. bm:bm-planner; the bm plugin
// renders it bm:bm-planner). Workflow bodies inherited from the npx install
// spawn agents by bare name, which fails on a plugin install with
// "Agent type 'bm-planner' not found. Available: ... bm:bm-planner". The
// orchestrator usually retries with the prefix, but every spawn eats a failed
// attempt first and an unattended run can dead-end.
//
// allow-test-rule: source-text-is-the-product
// Workflow/agent/skill .md files ARE the installed prompts; their text IS the
// deployed spawn contract.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const checks = [];
const ok = (label, cond) => checks.push([!!cond, label]);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, 'workflows')), ...walk(path.join(ROOT, 'skills')), ...walk(path.join(ROOT, 'agents'))];

// ─── 1. No bare subagent_type="(gsd|bm)-<name>" anywhere ─────────────────────
const bareSpawnRe = /subagent_type=["'](?:gsd|bm)-[a-z][a-z-]*["']/;     // bare (no bm: prefix)
const nsSpawnRe = /subagent_type=["']bm:bm-[a-z][a-z-]*["']/;           // namespaced (primary)
const bareSpawnOffenders = [];
let nsSpawnCount = 0;
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf-8');
  for (const line of txt.split('\n')) {
    if (/subagent_type=["']gsd:/.test(line)) { if (nsSpawnRe.test(line)) nsSpawnCount++; continue; }
    if (bareSpawnRe.test(line)) bareSpawnOffenders.push(`${path.relative(ROOT, f)}: ${line.trim().slice(0, 80)}`);
  }
}
ok(`no bare subagent_type="(gsd|bm)-*" (offenders: ${bareSpawnOffenders.length})`, bareSpawnOffenders.length === 0);
if (bareSpawnOffenders.length) bareSpawnOffenders.slice(0, 10).forEach((o) => console.log('   ' + o));
ok('namespaced spawns are present (sanity)', nsSpawnCount > 0);

// ─── 2. No legacy subagent_type="bm:gsd-<name>" remains ──────────────────────
const legacySpawnRe = /subagent_type=["']bm:gsd-[a-z][a-z-]*["']/;
const legacySpawnOffenders = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf-8');
  for (const line of txt.split('\n')) {
    if (legacySpawnRe.test(line)) legacySpawnOffenders.push(`${path.relative(ROOT, f)}: ${line.trim().slice(0, 80)}`);
  }
}
ok(`no legacy subagent_type="bm:gsd-*" (offenders: ${legacySpawnOffenders.length})`, legacySpawnOffenders.length === 0);
if (legacySpawnOffenders.length) legacySpawnOffenders.slice(0, 10).forEach((o) => console.log('   ' + o));

// ─── 3. <available_agent_types> prose lists use namespaced bm:bm-* ids ───────
const bareProseOffenders = [];
let nsProseCount = 0;
for (const f of walk(path.join(ROOT, 'workflows'))) {
  const txt = fs.readFileSync(f, 'utf-8');
  let inBlock = false;
  for (const line of txt.split('\n')) {
    if (/<available_agent_types>/.test(line)) inBlock = true;
    else if (/<\/available_agent_types>/.test(line)) inBlock = false;
    else if (inBlock && /^- (?:gsd|bm)-[a-z]/.test(line)) bareProseOffenders.push(`${path.relative(ROOT, f)}: ${line.trim().slice(0, 60)}`);
    else if (inBlock && /^- bm:bm-[a-z]/.test(line)) nsProseCount++;
  }
}
ok(`available_agent_types lists use bm:bm-* (offenders: ${bareProseOffenders.length})`, bareProseOffenders.length === 0);
if (bareProseOffenders.length) bareProseOffenders.slice(0, 10).forEach((o) => console.log('   ' + o));
ok('at least one bm:bm-* available_agent_types entry exists (sanity)', nsProseCount > 0);

for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
