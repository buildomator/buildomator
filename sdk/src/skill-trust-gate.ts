// Two-axis trust gate for curated craft-skill catalog entries. Every function
// is a pure structural check over catalog metadata: it takes an entry (and the
// policy tables that ship with the catalog) and returns a verdict object. No
// function here opens a skill file, reads any path, performs network access, or
// accepts free text, so there is no input a caller could use to talk a skill
// past the gate. The verdict shape follows the { safe, error } / { clean,
// findings[] } precedents in security.cjs. This is the SDK twin of
// bin/lib/skill-trust-gate.cjs; the two must stay byte-identical in behavior so
// a parity test can compare whole assessment objects across them. The
// external-validation merge (applyExternalValidation) is also a pure function
// over an already-captured run result; the spawn happens in the command handler
// and only when the caller opts in.

import { catalog as defaultCatalog, PINNED_COMMIT_RE } from './craft-skill-catalog.js';
import type { CraftSkillCatalog, CraftSkillEntry } from './craft-skill-catalog.js';

export type LicenseVerdict = 'allow' | 'flag' | 'block';
export type LicenseCategory =
  | 'permissive'
  | 'copyleft'
  | 'source-available'
  | 'non-commercial'
  | 'proprietary'
  | 'no-license'
  | 'unknown';

export interface LicenseAssessment {
  verdict: LicenseVerdict;
  spdx: string;
  category: LicenseCategory;
  obligations: string;
  reason: string;
}

export type SafetyFindingCode =
  | 'publisher-not-allowlisted'
  | 'pin-not-commit'
  | 'scripts-unreviewed'
  | 'scripts-review-stale'
  | 'tier-c-hold'
  | 'tier-b-undeclared-execution'
  | 'tooling-license-missing'
  | 'tooling-license-blocked'
  | 'source-not-https'
  | 'entry-malformed'
  | 'external-validate-failed'
  | 'external-validate-unavailable';

export interface SafetyFinding {
  code: SafetyFindingCode;
  message: string;
}

export interface SafetyAssessment {
  safe: boolean;
  findings: SafetyFinding[];
  scripts_banned: boolean;
}

export interface ToolingAssessment {
  name: string;
  license: string;
  verdict: LicenseVerdict;
  category: LicenseCategory;
}

export interface EntryAssessment {
  id: string | undefined;
  verdict: LicenseVerdict;
  safety: SafetyAssessment;
  license: LicenseAssessment;
  tooling: ToolingAssessment[];
  scripts_banned: boolean;
  publisher: { id: string; label: string } | null;
  pinned_commit: string | undefined;
  source: string | undefined;
  skill_path: string | undefined;
  trust_tier: string | undefined;
  prompt: string[];
}

// Code -> one-line, plain-English explanation for each safety finding.
export const SAFETY_FINDINGS: Record<SafetyFindingCode, string> = Object.freeze({
  'publisher-not-allowlisted':
    "the skill's publisher is not on the catalog allowlist; only curated publishers may be inserted",
  'pin-not-commit':
    'pinned_commit must be a full 40-hex commit sha; branches, tags and HEAD float and cannot be reproduced',
  'scripts-unreviewed':
    'the skill bundles scripts but carries no review record; a human must review or ban them before it can be inserted',
  'scripts-review-stale':
    'the scripts review was recorded at a different commit than the pin; re-review at the pinned commit',
  'tier-c-hold':
    'trust tier C is held for manual handling and cannot be auto-assessed as safe',
  'tier-b-undeclared-execution':
    'trust tier B must declare its execution surface (bundled scripts or external tooling); this entry declares neither',
  'tooling-license-missing':
    'a declared tooling dependency has no license recorded; record its license before inserting',
  'tooling-license-blocked':
    'a declared tooling dependency carries a blocked license',
  'source-not-https':
    'the skill source must be an https URL; other transports are not accepted',
  'entry-malformed':
    'the catalog entry is not a well-formed object with a string id',
  'external-validate-failed':
    'the opt-in skills-ref validate run reported errors for the candidate skill directory; fix the SKILL.md or reject the candidate',
  'external-validate-unavailable':
    'the opt-in skills-ref validate run could not execute (npx missing, timed out or failed to spawn); the candidate is held until the check can run',
});

// The exact version pin for the opt-in external linter. Single-sourced so the
// argv builder and any caller agree on one literal. The --yes token is required
// because npx refuses to auto-install without a TTY; the pin plus the opt-in
// flag are the trust controls.
export const SKILLS_REF_PIN = 'skills-ref@0.1.5';

export function externalValidateArgv(dir: string): string[] {
  return ['--yes', SKILLS_REF_PIN, 'validate', dir];
}

export interface ExternalValidateRun {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Trim and collapse internal whitespace. A non-string or empty value becomes ''.
export function normalizeSpdx(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/\s+/g, ' ');
}

function makeLicenseVerdict(
  verdict: LicenseVerdict,
  spdx: string,
  category: LicenseCategory,
  obligations: string,
  reason: string
): LicenseAssessment {
  return { verdict, spdx, category, obligations, reason };
}

// Match a license id against one of the policy lists case-insensitively and
// return the list's own spelling (so obligations can be looked up by id).
function findCanonical(list: unknown, id: string): string | null {
  if (!Array.isArray(list)) return null;
  const low = id.toLowerCase();
  for (const candidate of list) {
    if (typeof candidate === 'string' && candidate.toLowerCase() === low) return candidate;
  }
  return null;
}

const NO_LICENSE_IDS = new Set(['', 'none', 'noassertion', 'unlicensed']);

// Classify a single (non-compound) SPDX id against the policy tables.
function classifyOne(spdx: string, cat: CraftSkillCatalog): LicenseAssessment {
  const policy = cat.licensePolicy;
  const low = spdx.toLowerCase();

  if (NO_LICENSE_IDS.has(low)) {
    return makeLicenseVerdict('block', spdx, 'no-license', '', `${spdx || '(empty)'} declares no usable license; blocked`);
  }

  let canon = findCanonical(policy.allow, spdx);
  if (canon) {
    return makeLicenseVerdict('allow', spdx, 'permissive', policy.obligations[canon] || '', `${canon} is an OSI permissive license`);
  }
  canon = findCanonical(policy.flagCopyleft, spdx);
  if (canon) {
    return makeLicenseVerdict('flag', spdx, 'copyleft', policy.obligations[canon] || '', `${canon} is copyleft; a human must decide`);
  }
  canon = findCanonical(policy.flagSourceAvailable, spdx);
  if (canon) {
    return makeLicenseVerdict('flag', spdx, 'source-available', policy.obligations[canon] || '', `${canon} is source-available; a human must decide`);
  }
  canon = findCanonical(policy.block, spdx);
  if (canon) {
    const category: LicenseCategory = /nc/i.test(canon) || /noncommercial/i.test(canon) ? 'non-commercial' : 'proprietary';
    return makeLicenseVerdict('block', spdx, category, '', `${canon} is ${category}; blocked by policy`);
  }
  return makeLicenseVerdict('block', spdx, 'unknown', '', `${spdx} is not in the license policy tables; add it deliberately or reject`);
}

// Split a compound SPDX expression on the OR / AND / WITH operators, stripping
// surrounding parentheses from each operand.
function splitCompound(expr: string): string[] {
  return expr
    .split(/\s+(?:OR|AND|WITH)\s+/i)
    .map((part) => part.replace(/^\(+|\)+$/g, '').trim())
    .filter(Boolean);
}

// Classify an SPDX id or compound expression. For compounds: OR keeps the best
// operand verdict (allow > flag > block), AND and WITH keep the worst, and any
// unknown operand forces block.
export function classifyLicense(spdx: unknown, cat: CraftSkillCatalog = defaultCatalog): LicenseAssessment {
  const norm = normalizeSpdx(spdx);
  if (!norm) {
    return makeLicenseVerdict('block', '', 'no-license', '', '(empty) declares no usable license; blocked');
  }

  const operands = splitCompound(norm);
  if (operands.length <= 1) {
    return classifyOne(norm, cat);
  }

  const isOr = /\sOR\s/i.test(norm);
  const results = operands.map((o) => classifyOne(o, cat));
  const obligations = results.map((r) => r.obligations).filter(Boolean).join(' | ');

  const unknown = results.find((r) => r.category === 'unknown');
  if (unknown) {
    return makeLicenseVerdict('block', norm, 'unknown', obligations, `${norm} contains an operand (${unknown.spdx}) not in the license policy tables; blocked`);
  }

  const rank = (v: LicenseVerdict): number => (v === 'allow' ? 2 : v === 'flag' ? 1 : 0);
  const governing = isOr
    ? results.reduce((a, b) => (rank(b.verdict) > rank(a.verdict) ? b : a))
    : results.reduce((a, b) => (rank(b.verdict) < rank(a.verdict) ? b : a));

  return makeLicenseVerdict(governing.verdict, norm, governing.category, obligations, `${norm} resolves to ${governing.verdict} (governed by ${governing.spdx})`);
}

function finding(code: SafetyFindingCode, suffix?: string): SafetyFinding {
  const base = SAFETY_FINDINGS[code];
  return { code, message: suffix ? `${base}${suffix}` : base };
}

// Structural safety axis. Returns { safe, findings[], scripts_banned }. Never
// throws: a malformed entry yields a single entry-malformed finding.
export function checkSafety(entry: unknown, cat: CraftSkillCatalog = defaultCatalog): SafetyAssessment {
  if (!isPlainObject(entry) || typeof entry.id !== 'string') {
    return { safe: false, findings: [finding('entry-malformed')], scripts_banned: false };
  }

  const e = entry as unknown as CraftSkillEntry;
  const findings: SafetyFinding[] = [];
  let scripts_banned = false;

  if (!Object.prototype.hasOwnProperty.call(cat.publishers, e.publisher)) {
    findings.push(finding('publisher-not-allowlisted'));
  }

  if (typeof e.pinned_commit !== 'string' || !PINNED_COMMIT_RE.test(e.pinned_commit)) {
    findings.push(finding('pin-not-commit'));
  }

  if (typeof e.source !== 'string' || !e.source.startsWith('https://')) {
    findings.push(finding('source-not-https'));
  }

  if (e.bundles_scripts === true) {
    const review = e.scripts_review;
    if (!isPlainObject(review) || (review.verdict !== 'reviewed' && review.verdict !== 'banned')) {
      findings.push(finding('scripts-unreviewed'));
    } else {
      if (review.commit !== e.pinned_commit) {
        findings.push(finding('scripts-review-stale'));
      }
      if (review.verdict === 'banned') {
        scripts_banned = true;
      }
    }
  }

  if (e.trust_tier === 'C') {
    findings.push(finding('tier-c-hold'));
  } else if (
    e.trust_tier === 'B' &&
    e.bundles_scripts === false &&
    Array.isArray(e.tooling) &&
    e.tooling.length === 0
  ) {
    findings.push(finding('tier-b-undeclared-execution'));
  }

  const tooling = Array.isArray(e.tooling) ? e.tooling : [];
  for (const tool of tooling) {
    const name = tool && typeof tool.name === 'string' ? tool.name : '(unnamed)';
    if (!tool || typeof tool.license !== 'string' || tool.license.length === 0) {
      findings.push(finding('tooling-license-missing', ` (tool: ${name})`));
    } else if (classifyLicense(tool.license, cat).verdict === 'block') {
      findings.push(finding('tooling-license-blocked', ` (tool: ${name})`));
    }
  }

  return { safe: findings.length === 0, findings, scripts_banned };
}

function scriptsText(entry: unknown, scriptsBanned: boolean): string {
  if (scriptsBanned) return 'BANNED, do not execute';
  if (!isPlainObject(entry) || entry.bundles_scripts !== true) return 'none';
  const review = entry.scripts_review;
  if (isPlainObject(review) && review.verdict === 'reviewed' && review.commit === entry.pinned_commit) {
    return 'reviewed at pin';
  }
  return 'unreviewed';
}

// Combine the two axes into a single assessment plus the insert-prompt lines.
// The verdict is a pure function of structured fields and policy tables.
export function assessEntry(entry: unknown, cat: CraftSkillCatalog = defaultCatalog): EntryAssessment {
  const e = (isPlainObject(entry) ? entry : {}) as Partial<CraftSkillEntry>;
  const safety = checkSafety(entry, cat);
  const license = classifyLicense(e.license, cat);

  const toolingList = Array.isArray(e.tooling) ? e.tooling : [];
  const tooling: ToolingAssessment[] = toolingList.map((tool) => {
    const name = tool && typeof tool.name === 'string' ? tool.name : '(unnamed)';
    const lic = tool && typeof tool.license === 'string' ? tool.license : '';
    const c = classifyLicense(lic, cat);
    return { name, license: lic, verdict: c.verdict, category: c.category };
  });

  const toolingBlocks = tooling.some((t) => t.verdict === 'block');
  const toolingFlags = tooling.some((t) => t.verdict === 'flag');

  let verdict: LicenseVerdict;
  if (!safety.safe || license.verdict === 'block' || toolingBlocks) {
    verdict = 'block';
  } else if (license.verdict === 'flag' || toolingFlags) {
    verdict = 'flag';
  } else {
    verdict = 'allow';
  }

  const pubEntry = typeof e.publisher === 'string' && isPlainObject(cat.publishers[e.publisher])
    ? cat.publishers[e.publisher]
    : null;
  const publisher = pubEntry ? { id: e.publisher as string, label: pubEntry.label } : null;

  const prompt: string[] = [];
  prompt.push(`${e.id}: ${e.summary}`);
  prompt.push(pubEntry ? `Publisher: ${pubEntry.label}` : `Publisher: NOT ON ALLOWLIST (${e.publisher})`);
  prompt.push(`License: ${license.spdx} (${license.category}, ${license.verdict})`);
  prompt.push(`Obligations: ${license.obligations}`);
  for (const t of tooling) {
    prompt.push(`Tooling: ${t.name} ${t.license} (${t.verdict})`);
  }
  prompt.push(`Trust tier: ${e.trust_tier}; bundled scripts: ${scriptsText(e, safety.scripts_banned)}`);
  prompt.push(`Pin: ${e.source} @ ${e.pinned_commit} (${e.skill_path})`);
  for (const f of safety.findings) {
    prompt.push(`Finding: ${f.message}`);
  }
  prompt.push(`Verdict: ${verdict}`);

  return {
    id: e.id,
    verdict,
    safety,
    license,
    tooling,
    scripts_banned: safety.scripts_banned,
    publisher,
    pinned_commit: e.pinned_commit,
    source: e.source,
    skill_path: e.skill_path,
    trust_tier: e.trust_tier,
    prompt,
  };
}

export function renderAssessment(assessment: EntryAssessment): string {
  return assessment.prompt.join('\n');
}

// First non-empty, trimmed line of a text blob, or '' when there is none.
function firstNonEmptyLine(text: string): string {
  if (typeof text !== 'string') return '';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

// Return a copy of the assessment forced to block, with the finding appended to
// the safety axis and the prompt tail rewritten so the Finding line precedes a
// fresh Verdict: block. The input is never mutated.
function blockWithFinding(assessment: EntryAssessment, f: SafetyFinding): EntryAssessment {
  const safety: SafetyAssessment = {
    ...assessment.safety,
    findings: [...assessment.safety.findings, f],
    safe: false,
  };
  const prompt = assessment.prompt.slice();
  if (prompt.length > 0 && prompt[prompt.length - 1].startsWith('Verdict:')) {
    prompt.pop();
  }
  prompt.push(`Finding: ${f.message}`);
  prompt.push('Verdict: block');
  return { ...assessment, verdict: 'block', safety, prompt };
}

// Pure merge of an opt-in skills-ref validate run into an assessment. `run` is
// the captured { status, stdout, stderr, error } of the spawn. Fails closed: a
// spawn error or a null status yields external-validate-unavailable and a block;
// a non-zero exit yields external-validate-failed and a block; a clean run (exit
// 0) records the check in the prompt and leaves the verdict untouched. Never
// mutates the input assessment.
export function applyExternalValidation(assessment: EntryAssessment, run: ExternalValidateRun): EntryAssessment {
  const r = run || ({} as ExternalValidateRun);
  if ((typeof r.error === 'string' && r.error.length > 0) || r.status === null || r.status === undefined) {
    return blockWithFinding(assessment, finding('external-validate-unavailable', ` (${r.error || 'no exit status'})`));
  }
  if (r.status !== 0) {
    const line = firstNonEmptyLine(r.stderr) || firstNonEmptyLine(r.stdout) || `exit ${r.status}`;
    return blockWithFinding(assessment, finding('external-validate-failed', ` (${line.slice(0, 200)})`));
  }
  const prompt = assessment.prompt.slice();
  const cleanLine = `External validate: ${SKILLS_REF_PIN} clean`;
  if (prompt.length > 0 && prompt[prompt.length - 1].startsWith('Verdict:')) {
    prompt.splice(prompt.length - 1, 0, cleanLine);
  } else {
    prompt.push(cleanLine);
  }
  return { ...assessment, prompt };
}
