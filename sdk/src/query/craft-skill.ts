// Write side of scoped craft-skill insertion, SDK twin of
// bin/lib/craft-skill-insert.cjs. A catalog entry is assessed through the trust
// gate, requires a recorded human approval, is checked against the local
// checkout's pinned commit, then written as an agent_skills.<agent> entry
// through the existing locked config path (configSet) plus a reproducibility
// record under <planning>/craft-skills/pins.json. Ephemeral is the default;
// sticky survives release. The agentSkills reader is untouched: the location
// rules here mirror it so a stored entry is never one the reader would later
// refuse. A skill file is read only for its frontmatter name and a content
// hash; the body is never parsed, returned or logged. The record key set and
// ordering are byte-identical to the CJS twin so a parity test can compare them.
// The read-only match handler is the trigger pre-filter over the catalog: it
// substring-compares a scope string against the trigger index and reads no skill
// file.

import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';

import type { QueryHandler } from './utils.js';
import { planningPaths, detectRuntime, resolveGlobalSkillsBase, resolveGlobalSkillDir } from './helpers.js';
import { loadConfig } from '../config.js';
import type { GSDConfig } from '../config.js';
import { configSet } from './config-mutation.js';
import { normalizeAgentName, lookupByAgentName } from '../model-catalog.js';
import { loadCraftSkillCatalog, deriveCatalogViews } from '../craft-skill-catalog.js';
import type { CraftSkillCatalog, CraftSkillEntry } from '../craft-skill-catalog.js';
import { assessEntry, renderAssessment, externalValidateArgv, applyExternalValidation } from '../skill-trust-gate.js';
import type { EntryAssessment, LicenseVerdict, ExternalValidateRun } from '../skill-trust-gate.js';
import { GSDError, ErrorClassification } from '../errors.js';

export const PINS_RELATIVE_PATH = 'craft-skills/pins.json';
const GLOBAL_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const SHA1_HEAD_RE = /^[0-9a-f]{40}/;

// ─── reader guards (mirrored from skills.ts) ────────────────────────────────
// These two helpers mirror the guards in skills.ts so a stored entry is never
// one the reader refuses; kept verbatim rather than shared because skills.ts
// must stay byte-identical for its parity contract.

function resolveWithinBase(target: string, baseDir: string): string | null {
  try {
    const resolvedBase = existsSync(baseDir) ? realpathSync(baseDir) : resolve(baseDir);
    const absTarget = resolve(baseDir, target);
    const resolvedTarget = existsSync(absTarget) ? realpathSync(absTarget) : absTarget;
    const baseWithSep = resolvedBase.endsWith(sep) ? resolvedBase : resolvedBase + sep;
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(baseWithSep)) {
      return null;
    }
    return resolvedTarget;
  } catch {
    return null;
  }
}

function loadTrustedGlobalRoots(config: unknown): string[] {
  if (typeof config !== 'object' || config === null) return [];
  const section = (config as { agent_skills_security?: unknown }).agent_skills_security;
  if (typeof section !== 'object' || section === null) return [];
  const entries = (section as { trusted_global_roots?: unknown }).trusted_global_roots;
  if (!Array.isArray(entries)) return [];

  const home = homedir();
  let homeReal: string;
  try { homeReal = realpathSync(home); } catch { homeReal = resolve(home); }

  const roots: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    let expanded = entry;
    if (entry === '~') expanded = home;
    else if (entry.startsWith('~/')) expanded = join(home, entry.slice(2));
    if (!isAbsolute(expanded)) continue;
    let real: string;
    try { real = realpathSync(expanded); } catch { continue; }
    const rootOf = parse(real).root;
    if (real === rootOf || real === rootOf.replace(/[\\/]+$/, '')) continue;
    if (real === homeReal) continue;
    if (!roots.includes(real)) roots.push(real);
  }
  return roots;
}

// ─── pin records ────────────────────────────────────────────────────────────

// The reproducibility record. Key order is identical to the CJS twin's record
// so the parity test can compare the key sets directly.
export interface PinRecord {
  record_id: string;
  id: string;
  agent: string;
  mode: string;
  entry: string;
  source: string;
  skill_path: string;
  pinned_commit: string;
  pin_verified: boolean;
  local_head: string | null;
  skill_md_sha256: string;
  license: string;
  obligations: string;
  trust_tier: string;
  scripts_banned: boolean;
  verdict: string;
  approved_at: string;
  inserted_at: string;
  released_at: string | null;
}

export interface PinsFile {
  version: number;
  records: PinRecord[];
}

function pinsFilePath(planningDir: string): string {
  return join(planningDir, 'craft-skills', 'pins.json');
}

// Read the pins record file. A missing file is an empty structure; a parse
// error fails closed so a corrupt audit log never feeds a silent write.
export function readPins(planningDir: string): PinsFile {
  const p = pinsFilePath(planningDir);
  if (!existsSync(p)) return { version: 1, records: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    throw new GSDError('Failed to read craft-skills/pins.json: ' + (err as Error).message, ErrorClassification.Execution);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as PinsFile).records)) {
    throw new GSDError('craft-skills/pins.json is malformed: expected { version, records: [] }', ErrorClassification.Execution);
  }
  return parsed as PinsFile;
}

// Write the pins file atomically: a tmp file renamed over the target, so a
// crash mid-write never leaves a half-written audit log.
export function writePins(planningDir: string, pins: PinsFile): void {
  const p = pinsFilePath(planningDir);
  mkdirSync(dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(pins, null, 2) + '\n');
  renameSync(tmp, p);
}

// ─── flag parsing ─────────────────────────────────────────────────────────

export interface ParsedFlags {
  positional: string[];
  flags: Record<string, string | boolean>;
}

// Split argv into positional tokens and flags. A token starting with -- is a
// flag; it consumes the next token as its value unless that token is itself a
// flag or absent, in which case the flag is boolean true.
export function parseFlags(args: string[]): ParsedFlags {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
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

// ─── catalog + skill helpers ────────────────────────────────────────────────

function loadCatalogViews(opts: { catalog?: string }): {
  cat: CraftSkillCatalog;
  views: ReturnType<typeof deriveCatalogViews>;
} {
  const cat = loadCraftSkillCatalog(opts && opts.catalog ? opts.catalog : undefined);
  const views = deriveCatalogViews(cat);
  return { cat, views };
}

// Read only the first frontmatter block of a SKILL.md and return its name
// field. Stops at the end of the frontmatter: the body is never read.
export function readFrontmatterName(skillMdPath: string): string | null {
  let text: string;
  try {
    text = readFileSync(skillMdPath, 'utf8');
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

export function sha256File(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

export interface PinCheck {
  git: boolean;
  local_head: string | null;
  pin_verified: boolean;
}

// Compare the local checkout's git HEAD with the pinned commit. A non-git
// directory is accepted with pin_verified false so drift stays visible through
// the recorded SKILL.md hash instead.
export function verifyLocalPin(skillDir: string, pinnedCommit: string): PinCheck {
  const res = spawnSync('git', ['-C', skillDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 5000 });
  if (res.status === 0 && typeof res.stdout === 'string' && SHA1_HEAD_RE.test(res.stdout.trim())) {
    const local_head = res.stdout.trim().slice(0, 40);
    return { git: true, local_head, pin_verified: local_head === pinnedCommit };
  }
  return { git: false, local_head: null, pin_verified: false };
}

export interface LocationResolution {
  ok: boolean;
  kind?: 'path' | 'global';
  entry?: string;
  skillDir?: string;
  skillMd?: string;
  reason?: string;
}

// Resolve a --location into a concrete skill directory and SKILL.md, using the
// same acceptance rules and reason strings as the reader (and the CJS twin).
export function resolveLocation(projectDir: string, config: GSDConfig, location: string): LocationResolution {
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
    const runtime = detectRuntime(config as { runtime?: unknown });
    const base = resolveGlobalSkillsBase(runtime);
    if (base === null) {
      return { ok: false, reason: `runtime "${runtime}" does not use a skills directory` };
    }
    const skillDir = resolveGlobalSkillDir(runtime, name);
    if (skillDir === null) {
      return { ok: false, reason: `could not resolve global skill directory for "${name}"` };
    }
    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) {
      return { ok: false, reason: `global skill not found at ${skillMd}` };
    }
    const inBase = resolveWithinBase(skillMd, base) !== null;
    const trustedRoots = loadTrustedGlobalRoots(config);
    const inTrusted = !inBase && trustedRoots.some((root) => resolveWithinBase(skillMd, root) !== null);
    if (!inBase && !inTrusted) {
      return { ok: false, reason: 'resolves outside the runtime skills dir and outside agent_skills_security.trusted_global_roots' };
    }
    return { ok: true, kind: 'global', entry: location, skillDir, skillMd };
  }

  if (resolveWithinBase(location, projectDir) === null) {
    return { ok: false, reason: `unsafe location "${location}": escapes the project root` };
  }
  const skillDir = join(projectDir, location);
  const skillMd = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) {
    return { ok: false, reason: `skill not found at ${location}/SKILL.md` };
  }
  const entry = location.replace(/\\/g, '/').replace(/^\.\//, '');
  return { ok: true, kind: 'path', entry, skillDir, skillMd };
}

// Find a prior approval for the same id at the same pinned commit.
export function findApproval(pins: PinsFile, id: string, pinnedCommit: string): PinRecord | null {
  for (const record of pins.records) {
    if (record.id === id && record.pinned_commit === pinnedCommit && record.approved_at) {
      return record;
    }
  }
  return null;
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.slice();
  return [value];
}

// ─── insert / release / list / assess ──────────────────────────────────────

export interface InsertOpts {
  id?: string;
  agent?: string;
  location?: string;
  sticky?: boolean;
  approved?: boolean;
  catalog?: string;
}

export interface InsertNeedsApproval {
  inserted: false;
  needs_approval: true;
  verdict: LicenseVerdict;
  assessment: EntryAssessment;
  prompt: string[];
}

export interface InsertDone {
  inserted: true;
  id: string;
  agent: string;
  entry: string;
  mode: string;
  pinned_commit: string;
  pin_verified: boolean;
  record_id: string;
  prompt: string[];
}

export async function insertCraftSkill(
  projectDir: string,
  opts: InsertOpts,
  workstream?: string,
): Promise<InsertNeedsApproval | InsertDone> {
  const o = opts || {};
  if (!o.id || !o.agent || !o.location) {
    throw new GSDError(
      'Usage: craft-skill insert <id> --agent <type> --location <where> [--sticky] [--approved]',
      ErrorClassification.Validation,
    );
  }
  const agent = normalizeAgentName(o.agent);

  const { cat, views } = loadCatalogViews(o);
  const entry = views.CRAFT_SKILLS_BY_ID[o.id];
  if (!entry) {
    throw new GSDError(`unknown catalog id "${o.id}"`, ErrorClassification.Validation);
  }

  const assessment = assessEntry(entry, cat);
  if (assessment.verdict === 'block') {
    throw new GSDError('craft-skill insert refused: ' + renderAssessment(assessment), ErrorClassification.Validation);
  }

  const planningDir = planningPaths(projectDir, workstream).planning;
  const pins = readPins(planningDir);
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

  const config = await loadConfig(projectDir, workstream);
  const loc = resolveLocation(projectDir, config, o.location);
  if (!loc.ok) {
    throw new GSDError('craft-skill insert refused: ' + loc.reason, ErrorClassification.Validation);
  }

  const name = readFrontmatterName(loc.skillMd as string);
  if (name !== entry.skill_name) {
    throw new GSDError(
      `craft-skill insert refused: skill-name-mismatch: SKILL.md declares ${name}, catalog expects ${entry.skill_name}`,
      ErrorClassification.Validation,
    );
  }

  const pin = verifyLocalPin(loc.skillDir as string, entry.pinned_commit);
  if (pin.git && !pin.pin_verified) {
    throw new GSDError(
      `craft-skill insert refused: pin-mismatch: checkout HEAD ${pin.local_head} differs from pinned commit ${entry.pinned_commit}`,
      ErrorClassification.Validation,
    );
  }
  const skill_md_sha256 = sha256File(loc.skillMd as string);

  const mode = o.sticky ? 'sticky' : 'ephemeral';
  const inserted_at = new Date().toISOString();
  const record_id = o.id + '@' + agent + '@' + inserted_at;

  const record: PinRecord = {
    record_id,
    id: o.id,
    agent,
    mode,
    entry: loc.entry as string,
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

  const fresh = readPins(planningDir);
  fresh.records.push(record);
  writePins(planningDir, fresh);

  const current = toArray(lookupByAgentName(config.agent_skills as Record<string, unknown>, agent));
  if (!current.includes(loc.entry as string)) {
    await configSet(['agent_skills.' + agent, JSON.stringify([...current, loc.entry])], projectDir, workstream);
  }

  return {
    inserted: true,
    id: o.id,
    agent,
    entry: loc.entry as string,
    mode,
    pinned_commit: entry.pinned_commit,
    pin_verified: pin.pin_verified,
    record_id,
    prompt: assessment.prompt,
  };
}

export interface ReleaseOpts {
  agent?: string;
  id?: string;
  includeSticky?: boolean;
  all?: boolean;
}

export async function releaseCraftSkills(
  projectDir: string,
  opts: ReleaseOpts,
  workstream?: string,
): Promise<{ released: string[]; remaining: number }> {
  const o = opts || {};
  if (!o.agent && !o.all) {
    throw new GSDError(
      'Usage: craft-skill release --agent <type> [--id <id>] [--include-sticky] | --all',
      ErrorClassification.Validation,
    );
  }
  const agent = o.agent ? normalizeAgentName(o.agent) : null;

  const planningDir = planningPaths(projectDir, workstream).planning;
  const pins = readPins(planningDir);
  const now = new Date().toISOString();
  const released: string[] = [];

  const selected = pins.records.filter((r) => {
    if (r.released_at !== null) return false;
    if (!o.all && r.agent !== agent) return false;
    if (o.id && r.id !== o.id) return false;
    if (!o.includeSticky && r.mode !== 'ephemeral') return false;
    return true;
  });

  if (selected.length > 0) {
    for (const record of selected) {
      const config = await loadConfig(projectDir, workstream);
      const current = toArray(lookupByAgentName(config.agent_skills as Record<string, unknown>, record.agent));
      const next = current.filter((e) => e !== record.entry);
      await configSet(['agent_skills.' + record.agent, JSON.stringify(next)], projectDir, workstream);
      record.released_at = now;
      released.push(record.record_id);
    }
    writePins(planningDir, pins);
  }

  const remaining = pins.records.filter((r) => r.released_at === null).length;
  return { released, remaining };
}

export function listCraftSkills(opts: { catalog?: string }): Array<Record<string, unknown>> {
  const { views } = loadCatalogViews(opts || {});
  return Object.values(views.CRAFT_SKILLS_BY_ID).map((e: CraftSkillEntry) => ({
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

export function assessCraftSkill(opts: { id?: string; catalog?: string; validateExternal?: string }): EntryAssessment {
  const o = opts || {};
  const { cat, views } = loadCatalogViews(o);
  const entry = o.id ? views.CRAFT_SKILLS_BY_ID[o.id] : undefined;
  if (!entry) {
    throw new GSDError(`unknown catalog id "${o.id}"`, ErrorClassification.Validation);
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
    throw new GSDError('--validate-external requires an existing skill directory', ErrorClassification.Validation);
  }
  const resolved = resolve(o.validateExternal);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new GSDError('--validate-external requires an existing skill directory', ErrorClassification.Validation);
  }
  const res = spawnSync('npx', externalValidateArgv(resolved), {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const run: ExternalValidateRun = {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error ? res.error.message : undefined,
  };
  return applyExternalValidation(base, run);
}

// ─── match (read-only trigger pre-filter) ───────────────────────────────────

export interface MatchCandidate {
  id: string;
  domain: string;
  matched_triggers: string[];
  publisher_label: string | null;
  license: string;
  obligations: string;
  trust_tier: string;
  verdict: LicenseVerdict;
  summary: string;
  target_agents: string[];
  prompt: string[];
}

export interface MatchResult {
  scope: string;
  candidates: MatchCandidate[];
}

// Lower-case the scope text and substring-compare it against the fixed trigger
// index, returning the matching catalog entries with the publisher label,
// license, obligations, trust tier, gate verdict and ready-to-render prompt
// lines so a surface needs no second assess call. The scope is handled as data
// only: no regex is built from it, no path is resolved, nothing is
// shell-expanded or evaluated.
export function matchCraftSkills(opts: { scope?: string; catalog?: string }): MatchResult {
  const o = opts || {};
  if (typeof o.scope !== 'string' || o.scope.trim().length === 0) {
    throw new GSDError(
      'Usage: craft-skill match "<scope text>" [--catalog <path>]',
      ErrorClassification.Validation,
    );
  }
  const { cat, views } = loadCatalogViews(o);
  const scopeLower = o.scope.toLowerCase();

  const idToTriggers = new Map<string, Set<string>>();
  for (const trigger of Object.keys(views.CRAFT_SKILL_TRIGGER_INDEX).sort()) {
    if (!scopeLower.includes(trigger)) continue;
    for (const id of views.CRAFT_SKILL_TRIGGER_INDEX[trigger]) {
      if (!idToTriggers.has(id)) idToTriggers.set(id, new Set());
      idToTriggers.get(id)!.add(trigger);
    }
  }

  const candidates: MatchCandidate[] = [...idToTriggers.keys()].sort().map((id) => {
    const entry = views.CRAFT_SKILLS_BY_ID[id];
    const a = assessEntry(entry, cat);
    return {
      id,
      domain: entry.domain,
      matched_triggers: [...idToTriggers.get(id)!].sort(),
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

// ─── query handlers ─────────────────────────────────────────────────────────

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export const craftSkillList: QueryHandler = async (args) => {
  const { flags } = parseFlags(args);
  return { data: listCraftSkills({ catalog: asString(flags.catalog) }) };
};

export const craftSkillAssess: QueryHandler = async (args) => {
  const { positional, flags } = parseFlags(args);
  // A bare `--validate-external` (no directory, or followed by another flag)
  // parses to boolean true. asString() would collapse that to undefined, which
  // the assess early-return reads as "validation not requested" and fails open.
  // Match the CJS twin: reject it loudly before asString sees it.
  const ve = flags['validate-external'];
  if (ve === true) {
    throw new GSDError('--validate-external requires an existing skill directory', ErrorClassification.Validation);
  }
  const a = assessCraftSkill({ id: positional[0], catalog: asString(flags.catalog), validateExternal: asString(ve) });
  if (flags['raw-text']) {
    return { data: renderAssessment(a), format: 'text' };
  }
  return { data: a };
};

export const craftSkillMatch: QueryHandler = async (args) => {
  const { positional, flags } = parseFlags(args);
  const result = matchCraftSkills({ scope: positional.join(' '), catalog: asString(flags.catalog) });
  if (flags['raw-text']) {
    return { data: result.candidates.map((c) => c.id).join('\n'), format: 'text' };
  }
  return { data: result };
};

export const craftSkillInsert: QueryHandler = async (args, projectDir, workstream) => {
  const { positional, flags } = parseFlags(args);
  return {
    data: await insertCraftSkill(
      projectDir,
      {
        id: positional[0],
        agent: asString(flags.agent),
        location: asString(flags.location),
        sticky: !!flags.sticky,
        approved: !!flags.approved,
        catalog: asString(flags.catalog),
      },
      workstream,
    ),
  };
};

export const craftSkillRelease: QueryHandler = async (args, projectDir, workstream) => {
  const { flags } = parseFlags(args);
  return {
    data: await releaseCraftSkills(
      projectDir,
      {
        agent: asString(flags.agent),
        id: asString(flags.id),
        includeSticky: !!flags['include-sticky'],
        all: !!flags.all,
      },
      workstream,
    ),
  };
};
