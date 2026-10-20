'use strict';

// End-to-end spec for scoped craft-skill insertion through the spawned
// gsd-tools CLI. Proves the read-only match pre-filter surfaces candidates
// from data-only scope text, that the write side writes only an
// agent_skills.<agent> entry plus a pins.json record, that the untouched
// reader scopes the skill to its target agent type only, that ephemeral is the
// default and sticky opts out of release, that approval is remembered per
// id+pin, that a drifted or escaping checkout is refused, and that nothing
// loads the catalog at startup.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const GSD_TOOLS = path.join(REPO_ROOT, 'bin', 'gsd-tools.cjs');
const COMMITTED_CATALOG = path.join(REPO_ROOT, 'sdk', 'shared', 'craft-skill-catalog.json');

const EXPECTED_KEYS = [
  'record_id', 'id', 'agent', 'mode', 'entry', 'source', 'skill_path',
  'pinned_commit', 'pin_verified', 'local_head', 'skill_md_sha256', 'license',
  'obligations', 'trust_tier', 'scripts_banned', 'verdict', 'approved_at',
  'inserted_at', 'released_at',
];

const checks = [];

function check(name, fn) {
  try { fn(); checks.push([true, name]); }
  catch (err) { checks.push([false, `${name}: ${err.message}`]); }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function withProject(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-craft-insert-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  try { return fn(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

// Round-trip the committed catalog, apply an optional mutator, write it into
// the project so a case can point the command at a tailored fixture.
function copyCatalog(root, mutate) {
  const obj = JSON.parse(fs.readFileSync(COMMITTED_CATALOG, 'utf8'));
  if (typeof mutate === 'function') mutate(obj);
  const p = path.join(root, 'catalog.json');
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

function runTool(root, args, extraEnv) {
  const res = spawnSync(process.execPath, [GSD_TOOLS, ...args], {
    cwd: root,
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, 'cfg'), ...(extraEnv || {}) },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function parseJson(res) {
  try {
    return JSON.parse(res.stdout);
  } catch (err) {
    throw new Error(`stdout is not JSON (${err.message})\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  }
}

function readConfig(root) {
  const p = path.join(root, '.planning', 'config.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readPins(root) {
  const p = path.join(root, '.planning', 'craft-skills', 'pins.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeConfig(root, config) {
  fs.writeFileSync(path.join(root, '.planning', 'config.json'), JSON.stringify(config));
}

function writeSkill(dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n# ${name}\n`);
}

function gitInit(dir) {
  spawnSync('git', ['init', '-q', dir]);
  spawnSync('git', ['-C', dir, 'add', '-A']);
  spawnSync('git', ['-C', dir, '-c', 'user.email=t@example.com', '-c', 'user.name=Test', 'commit', '-q', '-m', 'init']);
  return spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
}

function insertArgs(id, agent, location, extra) {
  return ['craft-skill', 'insert', id, '--agent', agent, '--location', location, ...(extra || [])];
}

const EXPECT_BLOCK = (root) => insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', path.join(root, 'catalog.json')]);

// --- list and assess ---

check('list returns the catalog entries with their pins', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    const expected = Object.keys(JSON.parse(fs.readFileSync(COMMITTED_CATALOG, 'utf8')).skills).length;
    const list = parseJson(runTool(root, ['craft-skill', 'list', '--catalog', cat]));
    assert(Array.isArray(list) && list.length === expected, `expected ${expected} entries: ${JSON.stringify(list)}`);
    const seo = list.find((e) => e.id === 'seo-audit');
    const duck = list.find((e) => e.id === 'duckdb-query');
    assert(seo && duck, 'both seed ids should be listed');
    assert(/^[0-9a-f]{40}$/.test(seo.pinned_commit), `seo pin should be a 40-hex sha: ${seo.pinned_commit}`);
  });
});

check('assess returns the allow verdict and a rendered prompt', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    const res = runTool(root, ['craft-skill', 'assess', 'duckdb-query', '--catalog', cat]);
    assert(res.status === 0, `assess should exit 0: ${res.stderr}`);
    const a = parseJson(res);
    assert(a.verdict === 'allow', `expected allow verdict: ${JSON.stringify(a.verdict)}`);
    const raw = runTool(root, ['craft-skill', 'assess', 'duckdb-query', '--catalog', cat, '--raw']);
    assert(raw.stdout.includes('Verdict: allow'), `rendered assessment should name the verdict: ${raw.stdout}`);
  });
});

// --- match (propose-on-fit pre-filter) ---

check('match surfaces the SEO candidate with its triggers, verdict and prompt lines', () => {
  withProject((root) => {
    const res = runTool(root, ['craft-skill', 'match', 'Audit my site SEO and fix the sitemap', '--catalog', COMMITTED_CATALOG]);
    assert(res.status === 0, `match should exit 0: ${res.stderr}`);
    const m = parseJson(res);
    assert(m.scope === 'Audit my site SEO and fix the sitemap', `scope should be echoed verbatim: ${JSON.stringify(m.scope)}`);
    assert(Array.isArray(m.candidates) && m.candidates.length === 1, `expected exactly one candidate: ${JSON.stringify(m.candidates)}`);
    const c = m.candidates[0];
    assert(c.id === 'seo-audit', `expected seo-audit: ${JSON.stringify(c.id)}`);
    assert(JSON.stringify(c.matched_triggers) === JSON.stringify(['seo', 'sitemap']), `matched_triggers mismatch: ${JSON.stringify(c.matched_triggers)}`);
    assert(c.verdict === 'allow', `expected allow verdict: ${JSON.stringify(c.verdict)}`);
    assert(c.trust_tier === 'A', `expected trust tier A: ${JSON.stringify(c.trust_tier)}`);
    assert(c.license === 'MIT', `expected MIT license: ${JSON.stringify(c.license)}`);
    assert(typeof c.obligations === 'string' && c.obligations.length > 0, `obligations should be a non-empty string: ${JSON.stringify(c.obligations)}`);
    assert(typeof c.publisher_label === 'string' && c.publisher_label.startsWith('published by'), `publisher_label should start with "published by": ${JSON.stringify(c.publisher_label)}`);
    assert(Array.isArray(c.prompt), `prompt should be an array: ${JSON.stringify(c.prompt)}`);
    assert(c.prompt.some((l) => l.startsWith('Publisher:')), `prompt should carry a Publisher line: ${JSON.stringify(c.prompt)}`);
    assert(c.prompt.some((l) => l.startsWith('Obligations:')), `prompt should carry an Obligations line: ${JSON.stringify(c.prompt)}`);
    assert(Array.isArray(c.target_agents) && c.target_agents.includes('bm-executor'), `target_agents should include bm-executor: ${JSON.stringify(c.target_agents)}`);
  });
});

check('match surfaces the DuckDB candidate for a data scope', () => {
  withProject((root) => {
    const m = parseJson(runTool(root, ['craft-skill', 'match', 'ad-hoc SQL over Parquet files with DuckDB', '--catalog', COMMITTED_CATALOG]));
    assert(m.candidates.length === 1, `expected one candidate: ${JSON.stringify(m.candidates)}`);
    const c = m.candidates[0];
    assert(c.id === 'duckdb-query', `expected duckdb-query: ${JSON.stringify(c.id)}`);
    assert(JSON.stringify(c.matched_triggers) === JSON.stringify(['ad-hoc sql', 'duckdb', 'parquet']), `matched_triggers mismatch: ${JSON.stringify(c.matched_triggers)}`);
    assert(c.verdict === 'allow', `expected allow verdict: ${JSON.stringify(c.verdict)}`);
    assert(c.trust_tier === 'B', `expected trust tier B: ${JSON.stringify(c.trust_tier)}`);
  });
});

check('match returns no candidates for an unrelated scope', () => {
  withProject((root) => {
    const m = parseJson(runTool(root, ['craft-skill', 'match', 'schedule the quarterly team offsite', '--catalog', COMMITTED_CATALOG]));
    assert(JSON.stringify(m.candidates) === JSON.stringify([]), `expected no candidates: ${JSON.stringify(m.candidates)}`);
  });
});

check('match treats the scope as data and echoes it verbatim', () => {
  withProject((root) => {
    const scope = '$(echo pwned); rm -rf / ; seo';
    const m = parseJson(runTool(root, ['craft-skill', 'match', scope, '--catalog', COMMITTED_CATALOG]));
    assert(m.scope === scope, `scope should be echoed verbatim: ${JSON.stringify(m.scope)}`);
    assert(m.candidates.length === 1 && m.candidates[0].id === 'seo-audit', `only seo-audit should match: ${JSON.stringify(m.candidates)}`);
    assert(fs.existsSync(root), 'the project root must still exist (nothing was executed)');
  });
});

check('match is case-insensitive', () => {
  withProject((root) => {
    const m = parseJson(runTool(root, ['craft-skill', 'match', 'TECHNICAL SEO INDEXING', '--catalog', COMMITTED_CATALOG]));
    assert(m.candidates.length === 1 && m.candidates[0].id === 'seo-audit', `expected seo-audit: ${JSON.stringify(m.candidates)}`);
    assert(JSON.stringify(m.candidates[0].matched_triggers) === JSON.stringify(['indexing', 'seo', 'technical seo']), `matched_triggers mismatch: ${JSON.stringify(m.candidates[0].matched_triggers)}`);
  });
});

check('match without a scope is a usage error', () => {
  withProject((root) => {
    const res = runTool(root, ['craft-skill', 'match']);
    assert(res.status !== 0, `expected non-zero exit: ${res.stdout}`);
    assert((res.stdout + res.stderr).includes('craft-skill match'), `expected usage mentioning craft-skill match: ${res.stderr}`);
  });
});

check('match reports a flag verdict for a copyleft fixture', () => {
  withProject((root) => {
    const cat = copyCatalog(root, (c) => { c.skills['duckdb-query'].license = 'GPL-3.0-only'; });
    const m = parseJson(runTool(root, ['craft-skill', 'match', 'query parquet with duckdb', '--catalog', cat]));
    assert(m.candidates.length === 1 && m.candidates[0].id === 'duckdb-query', `expected duckdb-query: ${JSON.stringify(m.candidates)}`);
    assert(m.candidates[0].verdict === 'flag', `copyleft fixture should report a flag verdict: ${JSON.stringify(m.candidates[0].verdict)}`);
  });
});

// --- needs approval, no writes ---

check('insert without approval returns needs_approval and writes nothing', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--catalog', cat]));
    assert(res.status === 0, `expected status 0, got ${res.status}: ${res.stderr}`);
    const json = parseJson(res);
    assert(json.inserted === false, `expected inserted false: ${JSON.stringify(json)}`);
    assert(json.needs_approval === true, `expected needs_approval true: ${JSON.stringify(json)}`);
    const prompt = json.prompt.join('\n');
    assert(prompt.includes('License: MIT'), `prompt missing License: MIT: ${prompt}`);
    assert(prompt.includes('Obligations: '), `prompt missing Obligations: ${prompt}`);
    assert(prompt.includes('Verdict: allow'), `prompt missing Verdict: allow: ${prompt}`);
    const cfg = readConfig(root);
    assert(cfg === null || !cfg.agent_skills, `config should have no agent_skills: ${JSON.stringify(cfg)}`);
    assert(readPins(root) === null, 'pins.json should not exist');
  });
});

// --- approved ephemeral insert ---

check('approved insert writes the config entry and one ephemeral pin record', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    assert(res.status === 0, `expected status 0, got ${res.status}: ${res.stderr}`);
    const json = parseJson(res);
    assert(json.inserted === true && json.mode === 'ephemeral', `expected inserted ephemeral: ${JSON.stringify(json)}`);
    const cfg = readConfig(root);
    assert(JSON.stringify(cfg.agent_skills['bm-executor']) === JSON.stringify(['.claude/skills/seo-audit']),
      `config entry mismatch: ${JSON.stringify(cfg.agent_skills)}`);
    const pins = readPins(root);
    assert(pins.records.length === 1, `expected 1 pin record: ${JSON.stringify(pins)}`);
    assert(Object.keys(pins.records[0]).join(',') === EXPECTED_KEYS.join(','),
      `pin key order mismatch: ${Object.keys(pins.records[0]).join(',')}`);
    assert(pins.records[0].released_at === null, 'released_at should be null');
  });
});

check('the pin record carries the catalog provenance and approval timestamp', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    const rec = readPins(root).records[0];
    assert(rec.license === 'MIT', `license should be carried: ${rec.license}`);
    assert(rec.trust_tier === 'A', `trust_tier should be carried: ${rec.trust_tier}`);
    assert(typeof rec.obligations === 'string' && rec.obligations.length > 0, 'obligations should be carried');
    assert(typeof rec.approved_at === 'string' && !Number.isNaN(Date.parse(rec.approved_at)),
      `approved_at should be an ISO string: ${rec.approved_at}`);
  });
});

// --- scoping through the real reader ---

check('inserted skill is scoped to its target agent type only', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));

    // Consume the reader through its raw-text path (how workflows embed the
    // block): a populated agent writes the block directly, an unconfigured or
    // empty agent yields an empty string.
    const expected = '<agent_skills>\nRead these user-configured skills:\n- @.claude/skills/seo-audit/SKILL.md\n</agent_skills>';
    const exec = runTool(root, ['agent-skills', 'bm-executor', '--raw']);
    assert(exec.stdout === expected, `bm-executor output mismatch: ${JSON.stringify(exec.stdout)}`);
    const legacy = runTool(root, ['agent-skills', 'gsd-executor', '--raw']);
    assert(legacy.stdout === expected, `gsd-executor output mismatch: ${JSON.stringify(legacy.stdout)}`);
    const planner = runTool(root, ['agent-skills', 'bm-planner', '--raw']);
    assert(planner.stdout === '', `bm-planner should be empty: ${JSON.stringify(planner.stdout)}`);
    const empty = runTool(root, ['agent-skills', '', '--raw']);
    assert(empty.stdout === '', `empty agent should be empty: ${JSON.stringify(empty.stdout)}`);
  });
});

// --- nothing reads the catalog at startup ---

check('no hook, skill body or startup path references the catalog', () => {
  const hooksDir = path.join(REPO_ROOT, 'hooks');
  const walk = (dir) => {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  };
  if (fs.existsSync(hooksDir)) {
    for (const f of walk(hooksDir)) {
      assert(!fs.readFileSync(f, 'utf8').includes('craft-skill'), `hooks file references craft-skill: ${f}`);
    }
  }
  const skillsDir = path.join(REPO_ROOT, 'skills');
  for (const name of fs.readdirSync(skillsDir)) {
    const md = path.join(skillsDir, name, 'SKILL.md');
    if (fs.existsSync(md)) {
      assert(!fs.readFileSync(md, 'utf8').includes('craft-skill'), `SKILL.md references craft-skill: ${md}`);
    }
  }
  const libDir = path.join(REPO_ROOT, 'bin', 'lib');
  const requirers = fs.readdirSync(libDir).filter((f) =>
    f.endsWith('.cjs') && /require\(['"]\.\/craft-skill-catalog\.cjs['"]\)/.test(fs.readFileSync(path.join(libDir, f), 'utf8')));
  const allowed = new Set(['craft-skill-insert.cjs', 'skill-trust-gate.cjs']);
  for (const f of requirers) {
    assert(allowed.has(f), `unexpected catalog requirer under bin/lib: ${f}`);
  }
});

// --- release ---

check('release removes the ephemeral entry and stamps released_at', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    const rel = parseJson(runTool(root, ['craft-skill', 'release', '--agent', 'bm-executor']));
    assert(rel.released.length === 1, `expected 1 released: ${JSON.stringify(rel)}`);
    const cfg = readConfig(root);
    assert(JSON.stringify(cfg.agent_skills['bm-executor']) === '[]', `config should be empty: ${JSON.stringify(cfg.agent_skills)}`);
    assert(runTool(root, ['agent-skills', 'bm-executor']).stdout === '', 'reader should emit nothing after release');
    const rec = readPins(root).records[0];
    assert(typeof rec.released_at === 'string' && !Number.isNaN(Date.parse(rec.released_at)),
      `released_at should be an ISO string: ${rec.released_at}`);
  });
});

check('re-insert after release succeeds without approval (approval remembered)', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    runTool(root, ['craft-skill', 'release', '--agent', 'bm-executor']);
    const again = parseJson(runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--catalog', cat])));
    assert(again.inserted === true, `re-insert should succeed without approval: ${JSON.stringify(again)}`);
  });
});

// --- sticky ---

check('sticky survives release unless --include-sticky is given', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'query'), 'query');
    const ins = parseJson(runTool(root, insertArgs('duckdb-query', 'bm-executor', '.claude/skills/query', ['--sticky', '--approved', '--catalog', cat])));
    assert(ins.inserted === true && ins.mode === 'sticky', `expected sticky insert: ${JSON.stringify(ins)}`);
    const rel = parseJson(runTool(root, ['craft-skill', 'release', '--agent', 'bm-executor']));
    assert(rel.released.length === 0, `sticky should not be released by a plain release: ${JSON.stringify(rel)}`);
    assert(runTool(root, ['agent-skills', 'bm-executor']).stdout.includes('.claude/skills/query/SKILL.md'),
      'sticky skill should still be listed after a plain release');
    const rel2 = parseJson(runTool(root, ['craft-skill', 'release', '--agent', 'bm-executor', '--id', 'duckdb-query', '--include-sticky']));
    assert(rel2.released.length === 1, `--include-sticky should release the sticky record: ${JSON.stringify(rel2)}`);
    assert(runTool(root, ['agent-skills', 'bm-executor']).stdout === '', 'sticky skill should be gone after --include-sticky');
  });
});

check('duplicate insert does not duplicate the config entry', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--catalog', cat]));
    const cfg = readConfig(root);
    assert(cfg.agent_skills['bm-executor'].length === 1, `config entry duplicated: ${JSON.stringify(cfg.agent_skills)}`);
  });
});

// --- block verdict refuses before any write ---

check('a blocked verdict refuses with --approved and writes nothing', () => {
  withProject((root) => {
    // A blocked license is the reachable block route: the publisher-allowlist
    // axis cannot disagree with the catalog validator, which reads the same
    // publishers map, so an unknown publisher never parses.
    const cat = copyCatalog(root, (c) => { c.skills['seo-audit'].license = 'UNLICENSED'; });
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    assert(res.status !== 0, `expected non-zero exit: ${res.stdout}`);
    assert((res.stderr + res.stdout).includes('craft-skill insert refused'), `expected refusal message: ${res.stderr}`);
    assert(readConfig(root) === null || !readConfig(root).agent_skills, 'no config write on block');
    assert(readPins(root) === null, 'no pins on block');
  });
});

// --- flag verdict needs an explicit approval ---

check('a flagged license needs approval, then inserts when approved', () => {
  withProject((root) => {
    const cat = copyCatalog(root, (c) => { c.skills['seo-audit'].license = 'GPL-3.0-only'; });
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'seo-audit');
    const needs = parseJson(runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--catalog', cat])));
    assert(needs.needs_approval === true, `expected needs_approval: ${JSON.stringify(needs)}`);
    assert(needs.prompt.join('\n').includes('Verdict: flag'), `expected Verdict: flag: ${needs.prompt.join('\n')}`);
    const ins = parseJson(runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat])));
    assert(ins.inserted === true, `expected inserted with approval: ${JSON.stringify(ins)}`);
  });
});

// --- path and pin rejections ---

check('a location outside the project is refused', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', '../outside', ['--approved', '--catalog', cat]));
    assert(res.status !== 0, 'expected non-zero exit');
    assert((res.stderr + res.stdout).includes('craft-skill insert refused'), `expected refusal: ${res.stderr}`);
    assert(readConfig(root) === null || !readConfig(root).agent_skills, 'no config write');
  });
});

check('a plugin-form global location is refused as unpinnable', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', 'global:superpowers:brainstorming', ['--approved', '--catalog', cat]));
    assert(res.status !== 0, 'expected non-zero exit');
    assert((res.stderr + res.stdout).includes('plugin-form'), `expected plugin-form reason: ${res.stderr}`);
  });
});

check('a SKILL.md name that disagrees with the catalog is refused', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, '.claude', 'skills', 'seo-audit'), 'other');
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    assert(res.status !== 0, 'expected non-zero exit');
    assert((res.stderr + res.stdout).includes('skill-name-mismatch'), `expected skill-name-mismatch: ${res.stderr}`);
  });
});

check('a checkout whose HEAD differs from the pin is refused (pin-mismatch)', () => {
  withProject((root) => {
    const cat = copyCatalog(root); // keeps the committed pinned_commit, which differs from the fresh repo HEAD
    const skillDir = path.join(root, '.claude', 'skills', 'seo-audit');
    writeSkill(skillDir, 'seo-audit');
    gitInit(skillDir);
    const res = runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    assert(res.status !== 0, 'expected non-zero exit');
    assert((res.stderr + res.stdout).includes('pin-mismatch'), `expected pin-mismatch: ${res.stderr}`);
  });
});

check('a checkout whose HEAD equals the pin inserts with pin_verified true', () => {
  withProject((root) => {
    const skillDir = path.join(root, '.claude', 'skills', 'seo-audit');
    writeSkill(skillDir, 'seo-audit');
    const head = gitInit(skillDir);
    const cat = copyCatalog(root, (c) => { c.skills['seo-audit'].pinned_commit = head; });
    const ins = parseJson(runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat])));
    assert(ins.inserted === true && ins.pin_verified === true, `expected pin_verified true: ${JSON.stringify(ins)}`);
    const rec = readPins(root).records[0];
    assert(rec.local_head === head, `local_head should equal HEAD: ${rec.local_head} vs ${head}`);
  });
});

check('a non-git checkout records pin_verified false and a SKILL.md sha256', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    const skillDir = path.join(root, '.claude', 'skills', 'seo-audit');
    writeSkill(skillDir, 'seo-audit');
    runTool(root, insertArgs('seo-audit', 'bm-executor', '.claude/skills/seo-audit', ['--approved', '--catalog', cat]));
    const rec = readPins(root).records[0];
    assert(rec.pin_verified === false, 'pin_verified should be false for a non-git dir');
    const expected = crypto.createHash('sha256').update(fs.readFileSync(path.join(skillDir, 'SKILL.md'))).digest('hex');
    assert(rec.skill_md_sha256 === expected, `skill_md_sha256 mismatch: ${rec.skill_md_sha256} vs ${expected}`);
  });
});

// --- trusted global roots (reuse, not widen) ---

check('a symlinked global skill is refused by default and accepted under a trusted root', () => {
  withProject((root) => {
    const cat = copyCatalog(root, (c) => { c.skills['seo-audit'].skill_name = 'ext-skill'; });
    writeSkill(path.join(root, 'outside', 'ext-skill'), 'ext-skill');
    fs.mkdirSync(path.join(root, 'cfg', 'skills'), { recursive: true });
    fs.symlinkSync(path.join(root, 'outside', 'ext-skill'), path.join(root, 'cfg', 'skills', 'ext-skill'), 'dir');

    const refused = runTool(root, insertArgs('seo-audit', 'bm-executor', 'global:ext-skill', ['--approved', '--catalog', cat]));
    assert(refused.status !== 0, 'symlinked global skill should be refused by default');
    assert((refused.stderr + refused.stdout).includes('trusted_global_roots'), `expected trusted_global_roots reason: ${refused.stderr}`);

    writeConfig(root, { agent_skills_security: { trusted_global_roots: [path.join(root, 'outside')] } });
    const ins = parseJson(runTool(root, insertArgs('seo-audit', 'bm-executor', 'global:ext-skill', ['--approved', '--catalog', cat])));
    assert(ins.inserted === true, `expected insert under trusted root: ${JSON.stringify(ins)}`);
    const skills = runTool(root, ['agent-skills', 'bm-executor']).stdout;
    assert(skills.includes(path.join('cfg', 'skills', 'ext-skill', 'SKILL.md')), `reader should show the resolved global path: ${skills}`);
  });
});

// --- config schema untouched ---

check('the config schema accepts the dynamic key and both schema twins are unchanged', () => {
  const cjs = require('../bin/lib/config-schema.cjs');
  assert(cjs.isValidConfigKey('agent_skills.bm-executor') === true, 'agent_skills.bm-executor should be valid');
  const diff = spawnSync('git', ['-C', REPO_ROOT, 'diff', '--quiet', '--', 'bin/lib/config-schema.cjs', 'sdk/src/query/config-schema.ts']);
  assert(diff.status === 0, 'config-schema twins must be unchanged by this plan');
});

// --- propose-on-fit end to end (SEO domain) ---

check('propose-on-fit end to end for the SEO domain: match, accept, insert, executor sees it, release clears it', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, 's1'), 'seo-audit');

    // match surfaces the candidate from the data-only scope text
    const m = parseJson(runTool(root, ['craft-skill', 'match', 'Audit my site SEO and fix the sitemap', '--catalog', cat]));
    const ID = m.candidates[0].id;
    assert(ID === 'seo-audit', `match should surface seo-audit: ${JSON.stringify(m.candidates)}`);

    // nothing is injected until accept: an insert without approval writes nothing
    const before = parseJson(runTool(root, insertArgs(ID, 'bm-executor', 's1', ['--catalog', cat])));
    assert(before.needs_approval === true, `expected needs_approval before accept: ${JSON.stringify(before)}`);
    assert(before.inserted === false, `expected inserted false before accept: ${JSON.stringify(before)}`);
    const cfgBefore = readConfig(root);
    assert(cfgBefore === null || !cfgBefore.agent_skills, `no config write before accept: ${JSON.stringify(cfgBefore)}`);
    assert(readPins(root) === null, 'no pins before accept');

    // accept: the default ephemeral insert lands the config entry and one pin
    const after = parseJson(runTool(root, insertArgs(ID, 'bm-executor', 's1', ['--approved', '--catalog', cat])));
    assert(after.inserted === true, `expected inserted after accept: ${JSON.stringify(after)}`);
    assert(after.mode === 'ephemeral', `expected ephemeral mode: ${JSON.stringify(after.mode)}`);
    assert(after.agent === 'bm-executor', `expected bm-executor agent: ${JSON.stringify(after.agent)}`);
    const cfg = readConfig(root);
    assert(JSON.stringify(cfg.agent_skills['bm-executor']) === JSON.stringify(['s1']), `config entry mismatch: ${JSON.stringify(cfg.agent_skills)}`);
    const rec = readPins(root).records[0];
    assert(rec.id === 'seo-audit', `pin id mismatch: ${JSON.stringify(rec.id)}`);
    assert(rec.verdict === 'allow', `pin verdict mismatch: ${JSON.stringify(rec.verdict)}`);
    assert(rec.released_at === null, `released_at should be null before release: ${JSON.stringify(rec.released_at)}`);

    // the executor reader sees it; the planner reader does not (scoped to target)
    const execOut = runTool(root, ['agent-skills', 'bm-executor']).stdout;
    assert(execOut.includes('s1'), `executor reader should reference s1: ${JSON.stringify(execOut)}`);
    const plannerOut = runTool(root, ['agent-skills', 'bm-planner']).stdout;
    assert(!plannerOut.includes('s1'), `planner reader must not reference s1: ${JSON.stringify(plannerOut)}`);

    // release with --id clears the config entry and stamps the pin
    const rel = parseJson(runTool(root, ['craft-skill', 'release', '--agent', 'bm-executor', '--id', ID]));
    assert(rel.released.length === 1, `expected one released record: ${JSON.stringify(rel)}`);
    assert(rel.remaining === 0, `expected no remaining records: ${JSON.stringify(rel)}`);
    const cfgAfter = readConfig(root);
    assert(JSON.stringify(cfgAfter.agent_skills['bm-executor']) === JSON.stringify([]), `config should be empty after release: ${JSON.stringify(cfgAfter.agent_skills)}`);
    const relRec = readPins(root).records[0];
    assert(typeof relRec.released_at === 'string' && !Number.isNaN(Date.parse(relRec.released_at)), `released_at should be an ISO timestamp: ${JSON.stringify(relRec.released_at)}`);
    assert(!runTool(root, ['agent-skills', 'bm-executor']).stdout.includes('s1'), 'executor reader should no longer reference s1');
  });
});

check('release with --id leaves another agent\'s and another id\'s ephemeral records untouched', () => {
  withProject((root) => {
    const cat = copyCatalog(root);
    writeSkill(path.join(root, 's1'), 'seo-audit');
    writeSkill(path.join(root, 's2'), 'query');
    runTool(root, insertArgs('seo-audit', 'bm-executor', 's1', ['--approved', '--catalog', cat]));
    runTool(root, insertArgs('duckdb-query', 'bm-executor', 's2', ['--approved', '--catalog', cat]));

    const rel = parseJson(runTool(root, ['craft-skill', 'release', '--agent', 'bm-executor', '--id', 'seo-audit']));
    assert(rel.released.length === 1, `expected one released record: ${JSON.stringify(rel)}`);
    const cfg = readConfig(root);
    assert(JSON.stringify(cfg.agent_skills['bm-executor']) === JSON.stringify(['s2']), `only the released entry should be gone: ${JSON.stringify(cfg.agent_skills)}`);
    const stamped = readPins(root).records.filter((r) => r.released_at !== null);
    assert(stamped.length === 1, `exactly one record should be stamped: ${JSON.stringify(readPins(root).records)}`);
    assert(stamped[0].id === 'seo-audit', `the stamped record should be seo-audit: ${JSON.stringify(stamped[0].id)}`);
  });
});

// --- report ---

let failed = 0;
for (const [ok, name] of checks) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`);
  }
}
console.log(`\n${checks.length - failed} passed, ${failed} failed, ${checks.length} total`);
process.exit(failed ? 1 : 0);
