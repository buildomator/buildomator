#!/usr/bin/env node
// Guards the craft-skill propose-on-fit wiring across workflows.
// Every workflow surface that runs `craft-skill.match` must filter the
// candidates to a valid target agent, and the filter one-liner must run.
// This covers the wiring that the markdown workflows carry at runtime,
// which the SDK unit suite does not exercise.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const wfDir = path.join(ROOT, 'workflows');
const agentsDir = path.join(ROOT, 'agents');

// Valid agent names come from agents/bm-*.md so the allowlist cannot drift.
const validAgents = new Set(
  fs
    .readdirSync(agentsDir)
    .filter((f) => /^bm-.*\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''))
);
assert(validAgents.size > 0, 'no bm-*.md agents found');

const workflows = fs.readdirSync(wfDir).filter((f) => f.endsWith('.md'));
let surfaces = 0;
for (const wf of workflows) {
  const text = fs.readFileSync(path.join(wfDir, wf), 'utf8');
  if (!text.includes('craft-skill.match')) continue;
  const filters = [...text.matchAll(/const A=\[([^\]]*)\]/g)];
  assert(
    filters.length > 0,
    `${wf}: runs craft-skill.match but has no 'const A=[...]' target-agent filter`
  );
  for (const m of filters) {
    surfaces++;
    const agents = m[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    assert(agents.length > 0, `${wf}: empty target-agent filter`);
    for (const a of agents) {
      assert(validAgents.has(a), `${wf}: filter names unknown agent '${a}'`);
    }
  }
}

// All six original surfaces plus the three lanes added for the superpowers
// catalog (planner, debugger, verifier) must be present.
assert(surfaces >= 9, `expected at least 9 propose-on-fit surfaces, found ${surfaces}`);

// The filter one-liner itself must parse, run, and filter by target agent.
const oneLiner =
  'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let j;try{j=JSON.parse(s)}catch{j={}}' +
  'const A=["bm-planner"];j.candidates=(j.candidates||[]).filter(c=>(c.target_agents||[]).some(a=>A.includes(a)));' +
  'console.log(JSON.stringify(j))})';
const input = JSON.stringify({
  candidates: [
    { id: 'keep', target_agents: ['bm-planner'] },
    { id: 'drop', target_agents: ['bm-debugger'] },
  ],
});
const out = execFileSync('node', ['-e', oneLiner], { input }).toString();
assert.deepStrictEqual(
  JSON.parse(out).candidates.map((c) => c.id),
  ['keep'],
  'filter one-liner did not keep only bm-planner candidates'
);

console.log(
  `craft-skill propose-on-fit wiring: OK (${surfaces} surfaces, all target valid agents, filter one-liner runs)`
);
