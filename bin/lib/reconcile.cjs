'use strict';

// Decision reconciliation engine (mechanical half), CJS twin of
// sdk/src/query/reconcile.ts. Reads the STATE.md decision log, retrieves
// same-topic rule lines from the project authority docs, keeps a content-hash
// ledger and a merge-preserving pending record, and gates which docs may be
// auto-rewritten. No model call happens here; decision and rule text are used
// only as data for phrase matching and hashing, never evaluated or passed to a
// shell. Output key order, hash algorithm and file formats must match the SDK.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { output, error, ERROR_REASON } = require('./core.cjs');

const LEDGER_REL = path.join('.planning', 'reconcile-ledger.json');
const PENDING_REL = path.join('.planning', 'reconcile-pending.json');
const AUTO_REWRITABLE_FILES = ['CLAUDE.md', 'PROJECT.md'];
const RECONCILE_OUTCOMES = ['reconciled-auto', 'reconciled-asked', 'dismissed'];
const MIN_SHARED_STEMS = 2;
const MIN_OVERLAP_RATIO = 0.4;
const STEM_LENGTH = 5;
const MIN_WORD_LENGTH = 4;
const STOPWORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'when', 'then', 'than', 'they', 'them', 'their',
  'there', 'what', 'will', 'would', 'should', 'could', 'must', 'each', 'every', 'only', 'also',
  'into', 'over', 'such', 'both', 'does', 'done', 'were', 'your', 'ours', 'itself', 'about', 'after',
  'before', 'because', 'which', 'while', 'where', 'these', 'those', 'being', 'always', 'never',
]);
const RULE_DOCS = ['CLAUDE.md', 'PROJECT.md', path.join('.planning', 'PROJECT.md')];

function normalizePhrase(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentHash(text) {
  return crypto.createHash('sha256').update(normalizePhrase(text)).digest('hex').slice(0, 16);
}

function stems(text) {
  const out = new Set();
  for (const w of normalizePhrase(text).split(' ')) {
    if (w.length >= MIN_WORD_LENGTH && !STOPWORDS.has(w)) out.add(w.slice(0, STEM_LENGTH));
  }
  return out;
}

function parseDecisionLog(stateContent) {
  const sectionPattern = /###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = stateContent.match(sectionPattern);
  if (!match) return [];
  const seen = new Set();
  const out = [];
  for (const line of match[1].split('\n')) {
    const m = line.match(/^- \[Phase [^\]]*\]:\s*(.+?)\s*$/);
    if (!m) continue;
    const text = m[1];
    const hash = contentHash(text);
    if (seen.has(hash)) continue;
    seen.add(hash);
    // Legacy on-disk separator is an em dash flanked by single spaces.
    const sepIdx = text.indexOf(' — ');
    const summary = sepIdx === -1 ? text : text.slice(0, sepIdx);
    out.push({ hash, text, summary });
  }
  return out;
}

function isManagedLine(lines, idx) {
  let start = 0;
  for (let i = idx; i >= 0; i--) {
    if (/^#/.test(lines[i])) { start = i; break; }
  }
  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#/.test(lines[i])) { end = i; break; }
  }
  for (let i = start; i < end; i++) {
    if (/do not edit manually|auto-managed/i.test(lines[i])) return true;
  }
  return false;
}

// Safety gate: only the repo-root CLAUDE.md and PROJECT.md are auto-rewritable.
// `line` is the 0-based line index inside `content`.
function assessTargetDoc(docPath, content, line, projectDir) {
  let rel = docPath;
  if (path.isAbsolute(docPath)) {
    if (!projectDir || path.dirname(docPath) !== path.resolve(projectDir)) {
      return { autoRewritable: false, surfaceReason: 'not a repo-root rule doc' };
    }
    rel = docPath.slice(path.resolve(projectDir).length + 1);
  }
  rel = rel.replace(/^\.\//, '');
  if (!AUTO_REWRITABLE_FILES.includes(rel)) {
    return { autoRewritable: false, surfaceReason: 'not a repo-root CLAUDE.md or PROJECT.md' };
  }
  const lines = content.split('\n');
  const target = lines[line];
  if (/^\s*@/.test(target === undefined ? '' : target)) {
    return { autoRewritable: false, surfaceReason: 'line is an @-include' };
  }
  if (isManagedLine(lines, line)) {
    return { autoRewritable: false, surfaceReason: 'inside an auto-managed do-not-edit block' };
  }
  return { autoRewritable: true, surfaceReason: null };
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, p);
}

function isDisabled(cwd) {
  const cfg = readJson(path.join(cwd, '.planning', 'config.json'));
  return !!(cfg && cfg.workflow && cfg.workflow.decision_reconciliation === false);
}

function readDecisions(cwd) {
  for (const p of [path.join(cwd, '.planning', 'STATE.md'), path.join(cwd, 'STATE.md')]) {
    if (fs.existsSync(p)) return parseDecisionLog(fs.readFileSync(p, 'utf-8'));
  }
  return [];
}

function readLedger(cwd) {
  const j = readJson(path.join(cwd, LEDGER_REL));
  return j && typeof j.entries === 'object' && j.entries ? j : { version: 1, entries: {} };
}

function readPending(cwd) {
  const j = readJson(path.join(cwd, PENDING_REL));
  return j && typeof j.entries === 'object' && j.entries ? j : { version: 1, entries: {} };
}

function findCandidates(cwd, decision) {
  const want = stems(decision.summary);
  const out = [];
  if (want.size === 0) return out;
  for (const rel of RULE_DOCS) {
    const full = path.join(cwd, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || /^#/.test(trimmed) || /^```/.test(trimmed) || /^<!--/.test(trimmed)) continue;
      const lineStems = stems(trimmed);
      let shared = 0;
      for (const s of lineStems) if (want.has(s)) shared++;
      if (shared < MIN_SHARED_STEMS || shared / Math.min(want.size, lineStems.size) < MIN_OVERLAP_RATIO) continue;
      const verdict = assessTargetDoc(rel, content, i, cwd);
      out.push({
        file: rel,
        ruleText: trimmed.replace(/^[-*>]\s+/, ''),
        autoRewritable: verdict.autoRewritable,
        surfaceReason: verdict.surfaceReason,
      });
    }
  }
  return out;
}

function pickDecision(decisions, args) {
  if (args.includes('--latest')) return decisions.length ? decisions[decisions.length - 1] : null;
  const hash = args.find((a) => !a.startsWith('--'));
  return hash ? decisions.find((d) => d.hash === hash) || null : null;
}

function describeDecision(cwd, d, ledger) {
  const candidates = findCandidates(cwd, d);
  const recorded = ledger.entries[d.hash];
  const ledgerOutcome = recorded ? recorded.outcome : null;
  return {
    decisionHash: d.hash,
    decisionText: d.text,
    candidates,
    ledgerOutcome,
    modelNeeded: candidates.length > 0 && ledgerOutcome === null,
  };
}

function reconcileCandidates(cwd, args) {
  if (isDisabled(cwd)) {
    return { skipped: true, reason: 'workflow.decision_reconciliation is false', candidates: [], modelNeeded: false };
  }
  const d = pickDecision(readDecisions(cwd), args);
  if (!d) {
    return { decisionHash: null, decisionText: null, candidates: [], ledgerOutcome: null, modelNeeded: false, reason: 'decision not found' };
  }
  return describeDecision(cwd, d, readLedger(cwd));
}

function reconcileSweep(cwd) {
  if (isDisabled(cwd)) {
    return { skipped: true, reason: 'workflow.decision_reconciliation is false', decisions: [], count: 0 };
  }
  const ledger = readLedger(cwd);
  const decisions = readDecisions(cwd)
    .filter((d) => !ledger.entries[d.hash])
    .map((d) => describeDecision(cwd, d, ledger));
  return { decisions, count: decisions.length };
}

function reconcileRecord(cwd, args) {
  const hash = args.find((a) => !a.startsWith('--'));
  const oIdx = args.indexOf('--outcome');
  const outcome = oIdx !== -1 ? args[oIdx + 1] : undefined;
  if (!hash) return { error: 'decision hash required' };
  if (!outcome || !RECONCILE_OUTCOMES.includes(outcome)) {
    return { error: `--outcome must be one of ${RECONCILE_OUTCOMES.join(', ')}` };
  }
  const ledger = readLedger(cwd);
  const existing = ledger.entries[hash];
  let changed = false;
  if (!existing || existing.outcome !== outcome) {
    ledger.entries[hash] = { outcome, at: new Date().toISOString() };
    writeJsonAtomic(path.join(cwd, LEDGER_REL), ledger);
    changed = true;
  }
  const pending = readPending(cwd);
  const drained = Object.prototype.hasOwnProperty.call(pending.entries, hash);
  if (drained) {
    delete pending.entries[hash];
    writeJsonAtomic(path.join(cwd, PENDING_REL), pending);
  }
  return { recorded: true, hash, outcome, changed, drainedPending: drained };
}

function reconcilePending(cwd, args) {
  const d = pickDecision(readDecisions(cwd), args);
  if (!d) return { error: 'decision not found' };
  const pending = readPending(cwd);
  pending.entries[d.hash] = {
    decisionText: d.text,
    candidates: findCandidates(cwd, d).map((c) => ({ file: c.file, ruleText: c.ruleText })),
  };
  writeJsonAtomic(path.join(cwd, PENDING_REL), pending);
  return { pending: true, hash: d.hash, total: Object.keys(pending.entries).length };
}

function cmdReconcile(cwd, args, raw) {
  const sub = args[1];
  const rest = args.slice(2);
  switch (sub) {
    case 'candidates':
      return output(reconcileCandidates(cwd, rest), raw);
    case 'sweep':
      return output(reconcileSweep(cwd, rest), raw);
    case 'record':
      return output(reconcileRecord(cwd, rest), raw);
    case 'pending':
      return output(reconcilePending(cwd, rest), raw);
    default:
      return error('Usage: reconcile <candidates|record|sweep|pending> [args]', ERROR_REASON.USAGE);
  }
}

module.exports = {
  contentHash,
  parseDecisionLog,
  assessTargetDoc,
  reconcileCandidates,
  reconcileSweep,
  reconcileRecord,
  reconcilePending,
  cmdReconcile,
};
