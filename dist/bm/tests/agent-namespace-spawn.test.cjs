'use strict';

// Regression test for issue #14: workflow subagent spawns must use the
// plugin-namespaced agent id (gsd:gsd-<name>), not the bare upstream form
// (gsd-<name>).
//
// The plugin's plugin.json declares "name": "gsd", so Claude Code registers
// every agent under the `gsd:` namespace (e.g. gsd:gsd-planner). Workflow
// bodies inherited from the npx install spawn agents by bare name
// (subagent_type="gsd-planner"), which fails on a plugin install with
// "Agent type 'gsd-planner' not found. Available: ... gsd:gsd-planner". The
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

// ─── 1. No bare subagent_type="gsd-<name>" anywhere ──────────────────────────
const bareSpawnRe = /subagent_type=["']gsd-[a-z][a-z-]*["']/;            // bare (no gsd: prefix)
const nsSpawnRe = /subagent_type=["']gsd:gsd-[a-z][a-z-]*["']/;          // namespaced
const bareSpawnOffenders = [];
let nsSpawnCount = 0;
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf-8');
  for (const line of txt.split('\n')) {
    if (/subagent_type=["']gsd:/.test(line)) { if (nsSpawnRe.test(line)) nsSpawnCount++; continue; }
    if (bareSpawnRe.test(line)) bareSpawnOffenders.push(`${path.relative(ROOT, f)}: ${line.trim().slice(0, 80)}`);
  }
}
ok(`no bare subagent_type="gsd-*" (offenders: ${bareSpawnOffenders.length})`, bareSpawnOffenders.length === 0);
if (bareSpawnOffenders.length) bareSpawnOffenders.slice(0, 10).forEach((o) => console.log('   ' + o));
ok('namespaced spawns are present (sanity)', nsSpawnCount > 0);

// ─── 2. <available_agent_types> prose lists use namespaced ids ────────────────
const bareProseOffenders = [];
for (const f of walk(path.join(ROOT, 'workflows'))) {
  const txt = fs.readFileSync(f, 'utf-8');
  let inBlock = false;
  for (const line of txt.split('\n')) {
    if (/<available_agent_types>/.test(line)) inBlock = true;
    else if (/<\/available_agent_types>/.test(line)) inBlock = false;
    else if (inBlock && /^- gsd-[a-z]/.test(line)) bareProseOffenders.push(`${path.relative(ROOT, f)}: ${line.trim().slice(0, 60)}`);
  }
}
ok(`available_agent_types lists use gsd:gsd-* (offenders: ${bareProseOffenders.length})`, bareProseOffenders.length === 0);
if (bareProseOffenders.length) bareProseOffenders.slice(0, 10).forEach((o) => console.log('   ' + o));

for (const [pass, label] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([pass]) => !pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
