'use strict';

// Write side of scoped craft-skill insertion. A catalog entry is assessed
// through the trust gate, requires a recorded human approval, is checked
// against the local checkout's pinned commit, then written as an
// agent_skills.<agent> entry through the existing locked config path plus a
// reproducibility record under .planning/craft-skills/pins.json. Ephemeral is
// the default; sticky survives release. The reader (buildAgentSkillsBlock /
// cmdAgentSkills) is untouched: the location rules here mirror it so a stored
// entry is never one the reader would later refuse. This module reads a skill
// file only for its frontmatter name and a content hash; the body is never
// parsed, returned or logged. The read-only match subcommand is the trigger
// pre-filter over the catalog: it substring-compares a scope string against the
// trigger index and reads no skill file.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const { loadConfig, planningDir, output, error, ERROR_REASON, withPlanningLock } = require('./core.cjs');
const { setConfigValue } = require('./config.cjs');
const { validatePath, loadTrustedGlobalRoots } = require('./security.cjs');
const { getGlobalSkillsBase, getGlobalSkillDir } = require('./runtime-homes.cjs');
const { normalizeAgentName, lookupByAgentName } = require('./model-profiles.cjs');
const { loadCraftSkillCatalog, deriveCatalogViews } = require('./craft-skill-catalog.cjs');
const { assessEntry, renderAssessment, externalValidateArgv, applyExternalValidation } = require('./skill-trust-gate.cjs');

const PINS_RELATIVE_PATH = path.join('craft-skills', 'pins.json');
const GLOBAL_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const SHA1_HEAD_RE = /^[0-9a-f]{40}/;

function pinsPath(cwd) {
  return path.join(planningDir(cwd), PINS_RELATIVE_PATH);
}

// Read the pins record file. A missing file is an empty structure; a parse
// error fails closed so a corrupt audit log never feeds a silent write.
function readPins(cwd) {
  const p = pinsPath(cwd);
  if (!fs.existsSync(p)) return { version: 1, records: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records)) {
      return error('craft-skills/pins.json is malformed: expected { version, records: [] }', ERROR_REASON.CONFIG_PARSE_FAILED);
    }
    return parsed;
  } catch (err) {
    return error('Failed to read craft-skills/pins.json: ' + err.message, ERROR_REASON.CONFIG_PARSE_FAILED);
  }
}

// Write the pins file atomically: a tmp file renamed over the target, so a
// crash mid-write never leaves a half-written audit log.
function writePins(cwd, pins) {
  const p = pinsPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(pins, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

// Split argv into positional tokens and flags. A token starting with -- is a
// flag; it consumes the next token as its value unless that token is itself a
// flag or absent, in which case the flag is boolean true.
function parseFlags(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (typeof token === 'string' && token.startsWith('--')) {
      const name = token.slice(2);
      const next = args[i + 1];
      if (next === undefined || (typeof next === 'string' && next.startsWith('--'))) {
        flags[name] = true;
      } else {
        flags[name] = next;
        i++;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function loadCatalogViews(opts) {
  const cat = loadCraftSkillCatalog(opts && opts.catalog ? opts.catalog : undefined);
  const views = deriveCatalogViews(cat);
  return { cat, views };
}

// Read only the first frontmatter block of a SKILL.md and return its name
// field. Stops at the end of the frontmatter: the body is never read.
function readFrontmatterName(skillMdPath) {
  let text;
  try {
    text = fs.readFileSync(skillMdPath, 'utf8');
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') break;
    const m = /^name:\s*(.*)$/.exec(lines[i]);
    if (m) return m[1].trim();
  }
  return null;
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

// Compare the local checkout's git HEAD with the pinned commit. A non-git
// directory is accepted with pin_verified false so drift stays visible through
// the recorded SKILL.md hash instead.
function verifyLocalPin(skillDir, pinnedCommit) {
  const res = spawnSync('git', ['-C', skillDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 5000 });
  if (res.status === 0 && typeof res.stdout === 'string' && SHA1_HEAD_RE.test(res.stdout.trim())) {
    const local_head = res.stdout.trim().slice(0, 40);
    return { git: true, local_head, pin_verified: local_head === pinnedCommit };
  }
  return { git: false, local_head: null, pin_verified: false };
}

// Resolve a --location into a concrete skill directory and SKILL.md, using the
// same acceptance rules as the reader. Returns { ok, kind, entry, skillDir,
// skillMd, reason }.
function resolveLocation(cwd, config, location) {
  if (typeof location !== 'string' || location.length === 0) {
    return { ok: false, reason: 'location is required' };
  }

  if (location.startsWith('global:')) {
    const name = location.slice(7);
    if (name.includes(':')) {
      return { ok: false, reason: 'plugin-form skills carry no pin; use a project path or global:<name> checkout' };
    }
    if (!GLOBAL_NAME_RE.test(name)) {
      return { ok: false, reason: 'invalid global skill name; expected letters, digits, "_" or "-"' };
    }
    const runtime = (config && config.runtime) || 'claude';
    const base = getGlobalSkillsBase(runtime);
    if (base === null) {
      return { ok: false, reason: `runtime "${runtime}" does not use a skills directory` };
    }
    const skillDir = getGlobalSkillDir(runtime, name);
    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      return { ok: false, reason: `global skill not found at ${skillMd}` };
    }
    const inBase = validatePath(skillMd, base, { allowAbsolute: true }).safe;
    const trustedRoots = loadTrustedGlobalRoots(config);
    const inTrusted = !inBase && trustedRoots.some((root) => validatePath(skillMd, root, { allowAbsolute: true }).safe);
    if (!inBase && !inTrusted) {
      return { ok: false, reason: 'resolves outside the runtime skills dir and outside agent_skills_security.trusted_global_roots' };
    }
    return { ok: true, kind: 'global', entry: location, skillDir, skillMd };
  }

  const pathCheck = validatePath(location, cwd);
  if (!pathCheck.safe) {
    return { ok: false, reason: `unsafe location "${location}": ${pathCheck.error}` };
  }
  const skillDir = path.join(cwd, location);
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) {
    return { ok: false, reason: `skill not found at ${location}/SKILL.md` };
  }
  const entry = location.replace(/\\/g, '/').replace(/^\.\//, '');
  return { ok: true, kind: 'path', entry, skillDir, skillMd };
}

// Find a prior approval for the same id at the same pinned commit.
function findApproval(pins, id, pinnedCommit) {
  for (const record of pins.records) {
    if (record.id === id && record.pinned_commit === pinnedCommit && record.approved_at) {
      return record;
    }
  }
  return null;
}

function insertCraftSkill(cwd, opts) {
  const o = opts || {};
  if (!o.id || !o.agent || !o.location) {
    return error('Usage: craft-skill insert <id> --agent <type> --location <where> [--sticky] [--approved]', ERROR_REASON.USAGE);
  }
  const agent = normalizeAgentName(o.agent);

  const { cat, views } = loadCatalogViews(o);
  const entry = views.CRAFT_SKILLS_BY_ID[o.id];
  if (!entry) {
    return error(`unknown catalog id "${o.id}"`, ERROR_REASON.USAGE);
  }

  const assessment = assessEntry(entry, cat);
  if (assessment.verdict === 'block') {
    return error('craft-skill insert refused: ' + renderAssessment(assessment), ERROR_REASON.SECURITY_SCAN_FAILED);
  }

  const pins = readPins(cwd);
  const prior = findApproval(pins, o.id, entry.pinned_commit);
  if (!o.approved && !prior) {
    return {
      inserted: false,
      needs_approval: true,
      verdict: assessment.verdict,
      assessment,
      prompt: assessment.prompt,
    };
  }
  const approved_at = prior ? prior.approved_at : new Date().toISOString();

  const config = loadConfig(cwd);
  const loc = resolveLocation(cwd, config, o.location);
  if (!loc.ok) {
    return error('craft-skill insert refused: ' + loc.reason, ERROR_REASON.SECURITY_SCAN_FAILED);
  }

  const name = readFrontmatterName(loc.skillMd);
  if (name !== entry.skill_name) {
    return error(
      `craft-skill insert refused: skill-name-mismatch: SKILL.md declares ${name}, catalog expects ${entry.skill_name}`,
      ERROR_REASON.SECURITY_SCAN_FAILED
    );
  }

  const pin = verifyLocalPin(loc.skillDir, entry.pinned_commit);
  if (pin.git && !pin.pin_verified) {
    return error(
      `craft-skill insert refused: pin-mismatch: checkout HEAD ${pin.local_head} differs from pinned commit ${entry.pinned_commit}`,
      ERROR_REASON.SECURITY_SCAN_FAILED
    );
  }
  const skill_md_sha256 = sha256File(loc.skillMd);

  const mode = o.sticky ? 'sticky' : 'ephemeral';
  const inserted_at = new Date().toISOString();
  const record_id = o.id + '@' + agent + '@' + inserted_at;

  const record = {
    record_id,
    id: o.id,
    agent,
    mode,
    entry: loc.entry,
    source: entry.source,
    skill_path: entry.skill_path,
    pinned_commit: entry.pinned_commit,
    pin_verified: pin.pin_verified,
    local_head: pin.local_head,
    skill_md_sha256,
    license: entry.license,
    obligations: entry.obligations,
    trust_tier: entry.trust_tier,
    scripts_banned: assessment.scripts_banned,
    verdict: assessment.verdict,
    approved_at,
    inserted_at,
    released_at: null,
  };

  withPlanningLock(cwd, () => {
    const fresh = readPins(cwd);
    fresh.records.push(record);
    writePins(cwd, fresh);
  });

  const current = toArray(lookupByAgentName(config.agent_skills, agent));
  if (!current.includes(loc.entry)) {
    setConfigValue(cwd, 'agent_skills.' + agent, [...current, loc.entry]);
  }

  return {
    inserted: true,
    id: o.id,
    agent,
    entry: loc.entry,
    mode,
    pinned_commit: entry.pinned_commit,
    pin_verified: pin.pin_verified,
    record_id,
    prompt: assessment.prompt,
  };
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.slice();
  return [value];
}

function releaseCraftSkills(cwd, opts) {
  const o = opts || {};
  if (!o.agent && !o.all) {
    return error('Usage: craft-skill release --agent <type> [--id <id>] [--include-sticky] | --all', ERROR_REASON.USAGE);
  }
  const agent = o.agent ? normalizeAgentName(o.agent) : null;

  const pins = readPins(cwd);
  const now = new Date().toISOString();
  const released = [];

  const selected = pins.records.filter((r) => {
    if (r.released_at !== null) return false;
    if (!o.all && r.agent !== agent) return false;
    if (o.id && r.id !== o.id) return false;
    if (!o.includeSticky && r.mode !== 'ephemeral') return false;
    return true;
  });

  if (selected.length > 0) {
    for (const record of selected) {
      const config = loadConfig(cwd);
      const current = toArray(lookupByAgentName(config.agent_skills, record.agent));
      const next = current.filter((e) => e !== record.entry);
      setConfigValue(cwd, 'agent_skills.' + record.agent, next);
      record.released_at = now;
      released.push(record.record_id);
    }
    withPlanningLock(cwd, () => {
      writePins(cwd, pins);
    });
  }

  const remaining = pins.records.filter((r) => r.released_at === null).length;
  return { released, remaining };
}

function listCraftSkills(opts) {
  const { views } = loadCatalogViews(opts || {});
  return Object.values(views.CRAFT_SKILLS_BY_ID).map((e) => ({
    id: e.id,
    domain: e.domain,
    triggers: e.triggers,
    publisher: e.publisher,
    trust_tier: e.trust_tier,
    license: e.license,
    pinned_commit: e.pinned_commit,
    target_agents: e.target_agents,
    summary: e.summary,
  }));
}

function assessCraftSkill(opts) {
  const o = opts || {};
  const { cat, views } = loadCatalogViews(o);
  const entry = views.CRAFT_SKILLS_BY_ID[o.id];
  if (!entry) {
    return error(`unknown catalog id "${o.id}"`, ERROR_REASON.USAGE);
  }
  const base = assessEntry(entry, cat);
  if (o.validateExternal === undefined) {
    return base;
  }
  // The opt-in external linter: run only when the caller passes a real skill
  // directory. The path is checked before any spawn; the argv is an array (no
  // shell, so the directory is never expanded). A spawn error, timeout or
  // non-zero exit fails closed to a block through applyExternalValidation.
  if (typeof o.validateExternal !== 'string' || o.validateExternal.length === 0) {
    return error('--validate-external requires an existing skill directory', ERROR_REASON.USAGE);
  }
  const resolved = path.resolve(o.validateExternal);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return error('--validate-external requires an existing skill directory', ERROR_REASON.USAGE);
  }
  const res = spawnSync('npx', externalValidateArgv(resolved), {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const run = {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error ? res.error.message : undefined,
  };
  return applyExternalValidation(base, run);
}

// Read-only trigger pre-filter: lower-case the scope text and substring-compare
// it against the fixed trigger index, returning the matching catalog entries
// with the publisher label, license, obligations, trust tier, gate verdict and
// ready-to-render prompt lines so a surface needs no second assess call. The
// scope is handled as data only: no regex is built from it, no path is
// resolved, nothing is shell-expanded or evaluated.
function matchCraftSkills(opts) {
  const o = opts || {};
  if (typeof o.scope !== 'string' || o.scope.trim().length === 0) {
    return error('Usage: craft-skill match "<scope text>" [--catalog <path>]', ERROR_REASON.USAGE);
  }
  const { cat, views } = loadCatalogViews(o);
  const scopeLower = o.scope.toLowerCase();

  const idToTriggers = new Map();
  for (const trigger of Object.keys(views.CRAFT_SKILL_TRIGGER_INDEX).sort()) {
    if (!scopeLower.includes(trigger)) continue;
    for (const id of views.CRAFT_SKILL_TRIGGER_INDEX[trigger]) {
      if (!idToTriggers.has(id)) idToTriggers.set(id, new Set());
      idToTriggers.get(id).add(trigger);
    }
  }

  const candidates = [...idToTriggers.keys()].sort().map((id) => {
    const entry = views.CRAFT_SKILLS_BY_ID[id];
    const a = assessEntry(entry, cat);
    return {
      id,
      domain: entry.domain,
      matched_triggers: [...idToTriggers.get(id)].sort(),
      publisher_label: a.publisher ? a.publisher.label : null,
      license: entry.license,
      obligations: entry.obligations,
      trust_tier: entry.trust_tier,
      verdict: a.verdict,
      summary: entry.summary,
      target_agents: entry.target_agents,
      prompt: a.prompt,
    };
  });

  return { scope: o.scope, candidates };
}

function cmdCraftSkill(cwd, args, raw) {
  const sub = args[1];
  const { positional, flags } = parseFlags(args.slice(2));

  switch (sub) {
    case 'list':
      output(listCraftSkills({ catalog: flags.catalog }), raw);
      break;
    case 'assess': {
      const a = assessCraftSkill({ id: positional[0], catalog: flags.catalog, validateExternal: flags['validate-external'] });
      output(a, raw, renderAssessment(a));
      break;
    }
    case 'match': {
      const result = matchCraftSkills({ scope: positional.join(' '), catalog: flags.catalog });
      output(result, raw, result.candidates.map((c) => c.id).join('\n'));
      break;
    }
    case 'insert':
      output(
        insertCraftSkill(cwd, {
          id: positional[0],
          agent: flags.agent,
          location: flags.location,
          sticky: !!flags.sticky,
          approved: !!flags.approved,
          catalog: flags.catalog,
        }),
        raw
      );
      break;
    case 'release':
      output(
        releaseCraftSkills(cwd, {
          agent: flags.agent,
          id: flags.id,
          includeSticky: !!flags['include-sticky'],
          all: !!flags.all,
        }),
        raw
      );
      break;
    default:
      error('Usage: craft-skill <list|assess|match|insert|release> [args]', ERROR_REASON.USAGE);
  }
}

module.exports = {
  PINS_RELATIVE_PATH,
  parseFlags,
  readPins,
  verifyLocalPin,
  resolveLocation,
  insertCraftSkill,
  releaseCraftSkills,
  listCraftSkills,
  assessCraftSkill,
  matchCraftSkills,
  cmdCraftSkill,
};
