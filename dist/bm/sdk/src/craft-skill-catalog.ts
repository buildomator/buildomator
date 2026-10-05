import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export interface LicensePolicy {
  allow: string[];
  flagCopyleft: string[];
  flagSourceAvailable: string[];
  block: string[];
  obligations: Record<string, string>;
}

export interface CraftSkillPublisher {
  name: string;
  kind: 'vendor-official' | 'individual' | 'community';
  url: string;
  label: string;
}

export interface ScriptsReview {
  verdict: 'reviewed' | 'banned';
  commit: string;
  reviewed_at: string;
  note: string;
}

export interface ToolingRef {
  name: string;
  license: string;
  note: string;
}

export interface CraftSkillEntry {
  id: string;
  domain: string;
  triggers: string[];
  publisher: string;
  source: string;
  skill_path: string;
  skill_name: string;
  pinned_commit: string;
  license: string;
  license_url: string;
  obligations: string;
  trust_tier: 'A' | 'B' | 'C';
  bundles_scripts: boolean;
  scripts_review: ScriptsReview | null;
  tooling: ToolingRef[];
  target_agents: string[];
  summary: string;
  verified_at: string;
}

export interface CraftSkillCatalog {
  version: 1;
  licensePolicy: LicensePolicy;
  publishers: Record<string, CraftSkillPublisher>;
  skills: Record<string, CraftSkillEntry>;
}

export interface CatalogValidation {
  valid: boolean;
  errors: string[];
}

// The closed set of keys every skill entry must carry, in declaration order.
// A validated entry has exactly these keys: no missing keys, no extras. This
// is what makes "metadata and pins only, never a skill body" a checkable
// property rather than a promise.
export const ENTRY_KEYS: readonly string[] = Object.freeze([
  'id',
  'domain',
  'triggers',
  'publisher',
  'source',
  'skill_path',
  'skill_name',
  'pinned_commit',
  'license',
  'license_url',
  'obligations',
  'trust_tier',
  'bundles_scripts',
  'scripts_review',
  'tooling',
  'target_agents',
  'summary',
  'verified_at',
]);

export const TRUST_TIERS: readonly string[] = Object.freeze(['A', 'B', 'C']);
const PUBLISHER_KINDS: readonly string[] = Object.freeze(['vendor-official', 'individual', 'community']);
export const PINNED_COMMIT_RE = /^[0-9a-f]{40}$/;
export const MAX_STRING_LENGTH = 400;

// Key names that would smuggle a skill body into a metadata entry. Any of these
// on an entry is a hard validation failure.
export const FORBIDDEN_KEYS: readonly string[] = Object.freeze([
  'body',
  'content',
  'instructions',
  'skill_md',
  'markdown',
  'prompt',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
}

// Validate a parsed catalog. Returns { valid, errors } and never throws, so the
// loader can wrap it into a single fail-closed error and callers can report the
// findings. A corrupt catalog must never silently feed the trust gate. The
// error strings are byte-identical to the CJS twin so the parity test can
// compare errors arrays directly.
export function validateCraftSkillCatalog(raw: unknown): CatalogValidation {
  const errors: string[] = [];

  if (!isPlainObject(raw)) {
    return { valid: false, errors: ['catalog must be an object'] };
  }

  if (raw.version !== 1) {
    errors.push('version must be 1');
  }

  const policy = raw.licensePolicy;
  if (!isPlainObject(policy)) {
    errors.push('licensePolicy must be an object');
  } else {
    for (const field of ['allow', 'flagCopyleft', 'flagSourceAvailable', 'block']) {
      const arr = policy[field];
      if (!Array.isArray(arr) || !arr.every((item) => typeof item === 'string')) {
        errors.push(`licensePolicy.${field} must be an array of strings`);
      }
    }
    if (!isPlainObject(policy.obligations)) {
      errors.push('licensePolicy.obligations must be an object');
    } else {
      const obligations = policy.obligations as Record<string, unknown>;
      const covered = ([] as string[])
        .concat(Array.isArray(policy.allow) ? (policy.allow as string[]) : [])
        .concat(Array.isArray(policy.flagCopyleft) ? (policy.flagCopyleft as string[]) : [])
        .concat(Array.isArray(policy.flagSourceAvailable) ? (policy.flagSourceAvailable as string[]) : []);
      for (const id of covered) {
        if (typeof obligations[id] !== 'string' || (obligations[id] as string).length === 0) {
          errors.push(`licensePolicy.obligations is missing a line for ${id}`);
        }
      }
    }
  }

  const publishers = raw.publishers;
  if (!isPlainObject(publishers) || Object.keys(publishers).length === 0) {
    errors.push('publishers must be a non-empty object');
  } else {
    for (const [pid, pub] of Object.entries(publishers)) {
      if (!isPlainObject(pub)) {
        errors.push(`publisher ${pid} must be an object`);
        continue;
      }
      if (typeof pub.name !== 'string' || pub.name.length === 0) {
        errors.push(`publisher ${pid} name must be a non-empty string`);
      }
      if (!PUBLISHER_KINDS.includes(pub.kind as string)) {
        errors.push(`publisher ${pid} kind must be one of ${PUBLISHER_KINDS.join(', ')}`);
      }
      if (typeof pub.url !== 'string' || pub.url.length === 0) {
        errors.push(`publisher ${pid} url must be a non-empty string`);
      }
      if (typeof pub.label !== 'string' || pub.label.length === 0) {
        errors.push(`publisher ${pid} label must be a non-empty string`);
      }
    }
  }

  const skills = raw.skills;
  if (!isPlainObject(skills) || Object.keys(skills).length === 0) {
    errors.push('skills must be a non-empty object');
  } else {
    const allowedPublishers = isPlainObject(publishers) ? new Set(Object.keys(publishers)) : new Set<string>();
    for (const [key, entry] of Object.entries(skills)) {
      if (!isPlainObject(entry)) {
        errors.push(`skill ${key} must be an object`);
        continue;
      }

      const entryKeys = Object.keys(entry);
      for (const forbidden of FORBIDDEN_KEYS) {
        if (Object.prototype.hasOwnProperty.call(entry, forbidden)) {
          errors.push(`skill ${key} has forbidden key "${forbidden}" (skill bodies are never stored)`);
        }
      }
      for (const k of entryKeys) {
        if (!ENTRY_KEYS.includes(k) && !FORBIDDEN_KEYS.includes(k)) {
          errors.push(`skill ${key} has unknown key "${k}"`);
        }
      }
      for (const required of ENTRY_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(entry, required)) {
          errors.push(`skill ${key} is missing key "${required}"`);
        }
      }

      for (const [field, value] of Object.entries(entry)) {
        if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
          errors.push(`skill ${key} field "${field}" exceeds the ${MAX_STRING_LENGTH}-char cap (body-smuggling guard)`);
        }
      }

      if (entry.id !== key) {
        errors.push(`skill ${key} id must equal its map key`);
      }
      if (!isNonEmptyStringArray(entry.triggers)) {
        errors.push(`skill ${key} triggers must be a non-empty array of strings`);
      }
      if (!isNonEmptyStringArray(entry.target_agents)) {
        errors.push(`skill ${key} target_agents must be a non-empty array of strings`);
      }
      if (typeof entry.publisher !== 'string' || !allowedPublishers.has(entry.publisher)) {
        errors.push(`skill ${key} publisher "${entry.publisher}" is not in the publishers map`);
      }
      if (typeof entry.source !== 'string' || !entry.source.startsWith('https://')) {
        errors.push(`skill ${key} source must start with "https://"`);
      }
      if (typeof entry.pinned_commit !== 'string' || !PINNED_COMMIT_RE.test(entry.pinned_commit)) {
        errors.push(`skill ${key} pinned_commit must be a full 40-hex commit sha, not a branch, tag or HEAD`);
      }
      if (typeof entry.license !== 'string' || entry.license.length === 0) {
        errors.push(`skill ${key} license must be a non-empty string`);
      }
      if (typeof entry.obligations !== 'string' || entry.obligations.length === 0) {
        errors.push(`skill ${key} obligations must be a non-empty string`);
      }
      if (!TRUST_TIERS.includes(entry.trust_tier as string)) {
        errors.push(`skill ${key} trust_tier must be one of ${TRUST_TIERS.join(', ')}`);
      }
      if (typeof entry.bundles_scripts !== 'boolean') {
        errors.push(`skill ${key} bundles_scripts must be a boolean`);
      }
      if (entry.scripts_review !== null) {
        const sr = entry.scripts_review;
        if (!isPlainObject(sr)) {
          errors.push(`skill ${key} scripts_review must be null or an object`);
        } else {
          if (sr.verdict !== 'reviewed' && sr.verdict !== 'banned') {
            errors.push(`skill ${key} scripts_review.verdict must be "reviewed" or "banned"`);
          }
          if (typeof sr.commit !== 'string' || !PINNED_COMMIT_RE.test(sr.commit)) {
            errors.push(`skill ${key} scripts_review.commit must be a full 40-hex commit sha`);
          }
          if (typeof sr.reviewed_at !== 'string') {
            errors.push(`skill ${key} scripts_review.reviewed_at must be a string`);
          }
          if (typeof sr.note !== 'string') {
            errors.push(`skill ${key} scripts_review.note must be a string`);
          }
        }
      }
      if (!Array.isArray(entry.tooling)) {
        errors.push(`skill ${key} tooling must be an array`);
      } else {
        for (const tool of entry.tooling) {
          if (!isPlainObject(tool) || typeof tool.name !== 'string' || typeof tool.license !== 'string') {
            errors.push(`skill ${key} tooling items must have string name and license`);
          }
        }
      }
      if (typeof entry.summary !== 'string') {
        errors.push(`skill ${key} summary must be a string`);
      }
      if (typeof entry.verified_at !== 'string') {
        errors.push(`skill ${key} verified_at must be a string`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Resolve the catalog file: an explicit argument wins, then the
// GSD_CRAFT_SKILL_CATALOG env override, then the JSON co-located under
// sdk/shared relative to this module. Throws a diagnostic listing the
// candidates when the chosen file does not exist.
export function resolveCatalogPath(overridePath?: string): string {
  const candidates = [
    overridePath ? resolve(overridePath) : null,
    process.env.GSD_CRAFT_SKILL_CATALOG ? resolve(process.env.GSD_CRAFT_SKILL_CATALOG) : null,
    fileURLToPath(new URL('../shared/craft-skill-catalog.json', import.meta.url)),
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `craft-skill-catalog.json not found. Tried:\n${candidates.map((p) => `  ${p}`).join('\n')}`
  );
}

// Read, parse and validate the catalog. Parse errors propagate as-is; an
// invalid-but-parseable catalog throws a single fail-closed error so a corrupt
// file never feeds the gate.
export function loadCraftSkillCatalog(overridePath?: string): CraftSkillCatalog {
  const resolved = resolveCatalogPath(overridePath);
  const parsed = JSON.parse(readFileSync(resolved, 'utf-8'));
  const { valid, errors } = validateCraftSkillCatalog(parsed);
  if (!valid) {
    throw new Error('craft-skill-catalog.json invalid: ' + errors.join('; '));
  }
  return parsed as CraftSkillCatalog;
}

// Derive the lookups callers need: a shallow id->entry map, a trigger->ids
// index (lower-cased, sorted, de-duplicated) and the publisher-id allowlist.
export function deriveCatalogViews(cat: CraftSkillCatalog): {
  CRAFT_SKILLS_BY_ID: Record<string, CraftSkillEntry>;
  CRAFT_SKILL_TRIGGER_INDEX: Record<string, string[]>;
  PUBLISHER_ALLOWLIST: Set<string>;
} {
  const CRAFT_SKILLS_BY_ID: Record<string, CraftSkillEntry> = Object.fromEntries(Object.entries(cat.skills));

  const triggerToIds: Record<string, Set<string>> = {};
  for (const [id, entry] of Object.entries(cat.skills)) {
    for (const trigger of entry.triggers) {
      const key = String(trigger).toLowerCase();
      if (!triggerToIds[key]) triggerToIds[key] = new Set();
      triggerToIds[key].add(id);
    }
  }
  const CRAFT_SKILL_TRIGGER_INDEX: Record<string, string[]> = Object.fromEntries(
    Object.entries(triggerToIds).map(([trigger, ids]) => [trigger, [...ids].sort()])
  );

  const PUBLISHER_ALLOWLIST = new Set(Object.keys(cat.publishers));

  return { CRAFT_SKILLS_BY_ID, CRAFT_SKILL_TRIGGER_INDEX, PUBLISHER_ALLOWLIST };
}

export const catalog: CraftSkillCatalog = loadCraftSkillCatalog();
const _views = deriveCatalogViews(catalog);
export const CRAFT_SKILLS_BY_ID = _views.CRAFT_SKILLS_BY_ID;
export const CRAFT_SKILL_TRIGGER_INDEX = _views.CRAFT_SKILL_TRIGGER_INDEX;
export const PUBLISHER_ALLOWLIST = _views.PUBLISHER_ALLOWLIST;
