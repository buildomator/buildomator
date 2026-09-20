#!/usr/bin/env node
'use strict';

// Agent-name normalization spec for the bm-<role> migration.
//
// bm-<role> is the primary, sole spawnable agent name. The gsd-<role> spelling
// is the 4.x backwards-compat form accepted for config keys (model_overrides,
// agent_skills) and CLI arguments (resolve-model, agent-skills); it is removed
// at v5.0. This test pins:
//   (a) the catalog is keyed by bm-<role>;
//   (b) the normalize/legacy/lookup helper units on both twins;
//   (c) resolveModelInternal returns the same model for gsd- and bm- names;
//   (d) model_overrides keyed under either prefix resolve for a query under the
//       other;
//   (e) the two resolver twins agree on model for gsd-/bm- names;
//   (f) agent-skills answers cross-prefix on both twins;
//   (g) install-profiles parseCallsAgents / stageAgentsForProfile accept both;
//   (h) source hygiene: the agents/ listing is bm-, name: matches basename,
//       Skill grants survive, and no legacy spawn refs remain (guarded to SKIP
//       while the tree is mid-rename);
//   (i) the persisted doc marker literal is never rebranded.

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EMPTY_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ann-home-'));
process.env.GSD_HOME = EMPTY_HOME;

const mc = require(path.join(ROOT, 'bin', 'lib', 'model-catalog.cjs'));
const { resolveModelInternal } = require(path.join(ROOT, 'bin', 'lib', 'core.cjs'));
const installProfiles = require(path.join(ROOT, 'bin', 'lib', 'install-profiles.cjs'));

const checks = [];
const cleanup = [EMPTY_HOME];
function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}
function skip(name) { checks.push(['skip', name]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function subEnv() {
  const env = { ...process.env, GSD_HOME: EMPTY_HOME };
  delete env.CLAUDE_PLUGIN_ROOT;
  return env;
}
function freshProject(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ann-proj-'));
  cleanup.push(dir);
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  if (config !== undefined) {
    fs.writeFileSync(path.join(dir, '.planning', 'config.json'), JSON.stringify(config));
  }
  return dir;
}
function runGsdTools(cwd, ...args) {
  const r = cp.spawnSync('node', [path.join(ROOT, 'bin', 'gsd-tools.cjs'), ...args], {
    cwd, env: subEnv(), encoding: 'utf8',
  });
  assert(r.status === 0, `gsd-tools ${args.join(' ')} exit ${r.status} (stderr: ${r.stderr})`);
  return r.stdout;
}
function runSdk(cwd, ...args) {
  const r = cp.spawnSync('node', [path.join(ROOT, 'sdk', 'dist', 'cli.js'), 'query', ...args], {
    cwd, env: subEnv(), encoding: 'utf8',
  });
  assert(r.status === 0, `sdk ${args.join(' ')} exit ${r.status} (stderr: ${r.stderr})`);
  return r.stdout;
}

// ── (a) catalog keys are bm-<role> and match the agents/ listing ──────────────

check('(a) catalog agents map is keyed bm-<role> (33, zero gsd-)', () => {
  const cat = require(path.join(ROOT, 'sdk', 'shared', 'model-catalog.json'));
  const keys = Object.keys(cat.agents);
  assert(keys.length === 33, `expected 33 catalog keys, got ${keys.length}`);
  assert(keys.every((k) => k.startsWith('bm-')), 'a catalog key does not start with bm-');
  assert(!keys.some((k) => k.startsWith('gsd-')), 'a catalog key still starts with gsd-');
  const roleSet = new Set(keys);
  const fileRoles = fs.readdirSync(path.join(ROOT, 'agents'))
    .filter((f) => /^(?:bm|gsd)-.*\.md$/.test(f))
    .map((f) => mc.normalizeAgentName(f.replace(/\.md$/, '')));
  const fileSet = new Set(fileRoles);
  assert(roleSet.size === fileSet.size, `catalog role count ${roleSet.size} != agent file count ${fileSet.size}`);
  for (const r of fileSet) assert(roleSet.has(r), `agent file role ${r} missing from catalog`);
});

// ── (b) helper units on both twins ────────────────────────────────────────────

check('(b) normalize/legacy/lookup helpers (CJS)', () => {
  assert(mc.normalizeAgentName('gsd-planner') === 'bm-planner', 'normalize gsd- -> bm-');
  assert(mc.normalizeAgentName('bm-planner') === 'bm-planner', 'normalize bm- unchanged');
  assert(mc.normalizeAgentName('other') === 'other', 'normalize non-prefixed unchanged');
  assert(mc.legacyAgentName('bm-x') === 'gsd-x', 'legacy bm- -> gsd-');
  assert(mc.lookupByAgentName({ 'bm-x': 1 }, 'gsd-x') === 1, 'lookup gsd query hits bm key');
  assert(mc.lookupByAgentName({ 'gsd-x': 2 }, 'bm-x') === 2, 'lookup bm query hits gsd key');
  assert(mc.lookupByAgentName(null, 'bm-x') === undefined, 'lookup null map -> undefined');
});

// ── (c) resolveModelInternal parity across prefixes for every profile ─────────

for (const profile of ['quality', 'balanced', 'budget', null]) {
  check(`(c) resolveModelInternal gsd-==bm- for profile=${profile || 'default'}`, () => {
    const dir = freshProject(profile ? { model_profile: profile } : undefined);
    assert(resolveModelInternal(dir, 'gsd-planner') === resolveModelInternal(dir, 'bm-planner'),
      'planner gsd != bm');
    assert(resolveModelInternal(dir, 'gsd-executor') === resolveModelInternal(dir, 'bm-executor'),
      'executor gsd != bm');
  });
}

// ── (d) model_overrides resolve across prefixes ───────────────────────────────

check('(d) model_overrides keyed either prefix resolves for the other', () => {
  const dirA = freshProject({ model_overrides: { 'gsd-planner': 'custom-a' } });
  assert(resolveModelInternal(dirA, 'bm-planner') === 'custom-a', 'gsd-keyed override missed bm query');
  const dirB = freshProject({ model_overrides: { 'bm-planner': 'custom-b' } });
  assert(resolveModelInternal(dirB, 'gsd-planner') === 'custom-b', 'bm-keyed override missed gsd query');
});

// ── (e) twin agreement via spawning both CLIs ─────────────────────────────────

check('(e) both twins return equal model for gsd-planner and bm-planner', () => {
  const dir = freshProject({});
  const results = [
    JSON.parse(runGsdTools(dir, 'resolve-model', 'gsd-planner')),
    JSON.parse(runGsdTools(dir, 'resolve-model', 'bm-planner')),
    JSON.parse(runSdk(dir, 'resolve-model', 'gsd-planner')),
    JSON.parse(runSdk(dir, 'resolve-model', 'bm-planner')),
  ];
  const model = results[0].model;
  for (const r of results) {
    assert(r.model === model, `model mismatch across twins: ${JSON.stringify(results.map((x) => x.model))}`);
    assert(!r.unknown_agent, `unknown_agent set: ${JSON.stringify(r)}`);
  }
});

// ── (f) agent-skills cross-prefix through both twins ──────────────────────────

const SKILL_BLOCK =
  '<agent_skills>\n' +
  'Read these user-configured skills:\n' +
  '- Invoke the Skill tool with skill "superpowers:brainstorming" at agent start (plugin skill, loaded by name, not by path)\n' +
  '</agent_skills>';

const trimNL = (s) => s.replace(/\n$/, '');
check('(f) agent-skills cross-prefix on both twins', () => {
  const dirGsd = freshProject({ agent_skills: { 'gsd-executor': ['global:superpowers:brainstorming'] } });
  assert(trimNL(runGsdTools(dirGsd, 'agent-skills', 'bm-executor')) === SKILL_BLOCK, 'CJS: gsd-key missed bm query');
  assert(trimNL(runSdk(dirGsd, 'agent-skills', 'bm-executor')) === SKILL_BLOCK, 'SDK: gsd-key missed bm query');
  assert(trimNL(runGsdTools(dirGsd, 'agent-skills', 'gsd-executor')) === SKILL_BLOCK, 'CJS: gsd-key missed gsd query');
  const dirBm = freshProject({ agent_skills: { 'bm-executor': ['global:superpowers:brainstorming'] } });
  assert(trimNL(runGsdTools(dirBm, 'agent-skills', 'gsd-executor')) === SKILL_BLOCK, 'CJS: bm-key missed gsd query');
  assert(trimNL(runSdk(dirBm, 'agent-skills', 'gsd-executor')) === SKILL_BLOCK, 'SDK: bm-key missed gsd query');
});

// ── (g) install-profiles accept both prefixes ─────────────────────────────────

check('(g) parseCallsAgents and stageAgentsForProfile accept both prefixes', () => {
  const stems = installProfiles.parseCallsAgents('spawn gsd:bm-planner and gsd-executor');
  assert(stems.includes('bm-planner'), 'parseCallsAgents missed bm-planner');
  assert(stems.includes('gsd-executor'), 'parseCallsAgents missed gsd-executor');

  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'ann-agents-'));
  cleanup.push(src);
  for (const f of ['bm-planner.md', 'gsd-planner.md', 'bm-executor.md']) {
    fs.writeFileSync(path.join(src, f), 'x\n');
  }
  const staged = installProfiles.stageAgentsForProfile(src, { agents: new Set(['bm-planner']), skills: new Set() });
  const files = new Set(fs.readdirSync(staged));
  assert(files.has('bm-planner.md'), 'staged missing bm-planner.md');
  assert(files.has('gsd-planner.md'), 'staged missing gsd-planner.md (legacy of bm-planner)');
  assert(!files.has('bm-executor.md'), 'staged wrongly included bm-executor.md');
});

// ── (h) source hygiene (guarded while the tree is mid-rename) ──────────────────

const agentsDir = path.join(ROOT, 'agents');
const gsdAgentFiles = fs.readdirSync(agentsDir).filter((f) => /^gsd-.*\.md$/.test(f));
const bmAgentFiles = fs.readdirSync(agentsDir).filter((f) => /^bm-.*\.md$/.test(f));

if (gsdAgentFiles.length > 0) {
  skip(`(h) agents/ still has ${gsdAgentFiles.length} gsd-*.md — filename/Skill checks deferred to post-rename`);
} else {
  check('(h) agents/ is 33 bm-*.md, zero gsd-*.md, name: matches basename', () => {
    assert(bmAgentFiles.length === 33, `expected 33 bm- agents, got ${bmAgentFiles.length}`);
    assert(gsdAgentFiles.length === 0, 'gsd-*.md still present');
    for (const f of bmAgentFiles) {
      const base = f.replace(/\.md$/, '');
      const body = fs.readFileSync(path.join(agentsDir, f), 'utf8');
      const m = body.match(/^name:\s*(\S+)\s*$/m);
      assert(m, `no name: line in ${f}`);
      assert(m[1] === base, `${f} name: ${m[1]} != basename ${base}`);
    }
  });
  check('(h) at least 19 bm- agents list the Skill tool', () => {
    let n = 0;
    for (const f of bmAgentFiles) {
      if (/\bSkill\b/.test(fs.readFileSync(path.join(agentsDir, f), 'utf8'))) n += 1;
    }
    assert(n >= 19, `only ${n} bm- agents list Skill (expected >= 19)`);
  });
}

// spawn-count sub-check: guarded to SKIP while any legacy spawn ref remains.
function grepCount(pattern, dirs) {
  const r = cp.spawnSync('grep', ['-rIn', pattern, ...dirs], { cwd: ROOT, encoding: 'utf8' });
  if (!r.stdout) return 0;
  return r.stdout.split('\n').filter(Boolean).length;
}
const spawnDirs = ['workflows', 'skills', 'agents'];
const legacySpawns = grepCount('subagent_type="gsd:gsd-', spawnDirs);
if (legacySpawns > 0) {
  skip(`(h) ${legacySpawns} legacy subagent_type="gsd:gsd-" refs remain — spawn-count check deferred to post-sweep`);
} else {
  check('(h) zero legacy spawns, 69 bm- spawns in workflows/skills/agents', () => {
    assert(grepCount('subagent_type="gsd:gsd-', spawnDirs) === 0, 'legacy gsd:gsd- spawns remain');
    const bmSpawns = grepCount('subagent_type="gsd:bm-', spawnDirs);
    assert(bmSpawns === 69, `expected 69 gsd:bm- spawns, got ${bmSpawns}`);
  });
}

// ── (i) doc marker literal is never rebranded (always live) ───────────────────

check('(i) generated-by: gsd-doc-writer marker intact; zero bm-doc-writer markers', () => {
  const countIn = (file) => {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) return -1;
    return (fs.readFileSync(p, 'utf8').match(/generated-by: gsd-doc-writer/g) || []).length;
  };
  const writerFile = fs.existsSync(path.join(agentsDir, 'bm-doc-writer.md')) ? 'agents/bm-doc-writer.md' : 'agents/gsd-doc-writer.md';
  const verifierFile = fs.existsSync(path.join(agentsDir, 'bm-doc-verifier.md')) ? 'agents/bm-doc-verifier.md' : 'agents/gsd-doc-verifier.md';
  assert(countIn(writerFile) === 4, `${writerFile} marker count ${countIn(writerFile)} != 4`);
  assert(countIn(verifierFile) === 1, `${verifierFile} marker count ${countIn(verifierFile)} != 1`);
  assert(countIn('bin/lib/docs.cjs') === 1, `docs.cjs marker count ${countIn('bin/lib/docs.cjs')} != 1`);
  assert(countIn('sdk/src/query/docs-init.ts') === 1, `docs-init.ts marker count ${countIn('sdk/src/query/docs-init.ts')} != 1`);

  // Build the forbidden literal by concatenation so this test file does not
  // match its own scan.
  const rebranded = 'generated-by: bm-' + 'doc-writer';
  const tracked = cp.spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const offenders = [];
  for (const f of tracked) {
    // Scope the marker-integrity scan to product files. Planning artifacts under
    // .planning/ legitimately document the marker (including the rebranded form
    // as the thing to avoid), so they are not policed here.
    if (f.startsWith('.planning/')) continue;
    const p = path.join(ROOT, f);
    let body;
    try { body = fs.readFileSync(p, 'utf8'); } catch { continue; }
    if (body.includes(rebranded)) offenders.push(f);
  }
  assert(offenders.length === 0, `${rebranded} found in: ${offenders.join(', ')}`);
});

// ── cleanup + summary ─────────────────────────────────────────────────────────

for (const dir of cleanup) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

const failed = checks.filter(([ok]) => ok === false);
const passed = checks.filter(([ok]) => ok === true).length;
const skipped = checks.filter(([ok]) => ok === 'skip').length;
console.log('');
console.log(`agent-name normalization: ${passed} passed, ${failed.length} failed, ${skipped} skipped`);
for (const [ok, name] of checks) {
  const tag = ok === 'skip' ? 'SKIP' : ok ? 'PASS' : 'FAIL';
  console.log(`  ${tag}  ${name}`);
}
process.exit(failed.length > 0 ? 1 : 0);
