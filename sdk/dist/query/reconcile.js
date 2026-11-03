/**
 * Decision reconciliation engine (mechanical half).
 *
 * Reads the STATE.md decision log, retrieves same-topic rule lines from the
 * project authority docs, keeps a content-hash ledger of per-decision outcomes
 * and a merge-preserving pending-conflict record, and gates which docs may be
 * auto-rewritten. There is no model call anywhere in this file: the semantic
 * judgment is agent-driven (see references/decision-reconciliation.md).
 *
 * Decision and rule text are used only as data for phrase matching and hashing.
 * They are never evaluated, required, or interpolated into a shell command.
 *
 * CJS twin: bin/lib/reconcile.cjs. Output key order, hash algorithm and file
 * formats must stay byte-identical between the two.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { normalizePhrase } from './check-decision-coverage.js';
export const RECONCILE_OUTCOMES = ['reconciled-auto', 'reconciled-asked', 'dismissed'];
const LEDGER_REL = join('.planning', 'reconcile-ledger.json');
const PENDING_REL = join('.planning', 'reconcile-pending.json');
const AUTO_REWRITABLE_FILES = ['CLAUDE.md', 'PROJECT.md'];
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
// ─── pure helpers ───────────────────────────────────────────────────────────
export function contentHash(text) {
    return createHash('sha256').update(normalizePhrase(text)).digest('hex').slice(0, 16);
}
function stems(text) {
    const out = new Set();
    for (const w of normalizePhrase(text).split(' ')) {
        if (w.length >= MIN_WORD_LENGTH && !STOPWORDS.has(w))
            out.add(w.slice(0, STEM_LENGTH));
    }
    return out;
}
/** Parse the Decisions section bullets (`- [Phase N]: summary<sep>rationale`). */
export function parseDecisionLog(stateContent) {
    const sectionPattern = /###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = stateContent.match(sectionPattern);
    if (!match)
        return [];
    const seen = new Set();
    const out = [];
    for (const line of match[1].split('\n')) {
        const m = line.match(/^- \[Phase [^\]]*\]:\s*(.+?)\s*$/);
        if (!m)
            continue;
        const text = m[1];
        const hash = contentHash(text);
        if (seen.has(hash))
            continue;
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
        if (/^#/.test(lines[i])) {
            start = i;
            break;
        }
    }
    let end = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
        if (/^#/.test(lines[i])) {
            end = i;
            break;
        }
    }
    for (let i = start; i < end; i++) {
        if (/do not edit manually|auto-managed/i.test(lines[i]))
            return true;
    }
    return false;
}
/**
 * Safety gate: only the repo-root CLAUDE.md and PROJECT.md are auto-rewritable.
 * `line` is the 0-based line index inside `content`.
 */
export function assessTargetDoc(path, content, line, projectDir) {
    let rel = path;
    if (isAbsolute(path)) {
        if (!projectDir || dirname(path) !== resolve(projectDir)) {
            return { autoRewritable: false, surfaceReason: 'not a repo-root rule doc' };
        }
        rel = path.slice(resolve(projectDir).length + 1);
    }
    rel = rel.replace(/^\.\//, '');
    if (!AUTO_REWRITABLE_FILES.includes(rel)) {
        return { autoRewritable: false, surfaceReason: 'not a repo-root CLAUDE.md or PROJECT.md' };
    }
    const lines = content.split('\n');
    if (/^\s*@/.test(lines[line] ?? '')) {
        return { autoRewritable: false, surfaceReason: 'line is an @-include' };
    }
    if (isManagedLine(lines, line)) {
        return { autoRewritable: false, surfaceReason: 'inside an auto-managed do-not-edit block' };
    }
    return { autoRewritable: true, surfaceReason: null };
}
// ─── file access ────────────────────────────────────────────────────────────
function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
function writeJsonAtomic(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf-8');
    renameSync(tmp, path);
}
function isDisabled(cwd) {
    const cfg = readJson(join(cwd, '.planning', 'config.json'));
    return cfg?.workflow?.decision_reconciliation === false;
}
function readDecisions(cwd) {
    for (const p of [join(cwd, '.planning', 'STATE.md'), join(cwd, 'STATE.md')]) {
        if (existsSync(p))
            return parseDecisionLog(readFileSync(p, 'utf-8'));
    }
    return [];
}
function readLedger(cwd) {
    const j = readJson(join(cwd, LEDGER_REL));
    return j && typeof j.entries === 'object' && j.entries ? j : { version: 1, entries: {} };
}
function readPending(cwd) {
    const j = readJson(join(cwd, PENDING_REL));
    return j && typeof j.entries === 'object' && j.entries ? j : { version: 1, entries: {} };
}
const RULE_DOCS = ['CLAUDE.md', 'PROJECT.md', join('.planning', 'PROJECT.md')];
function findCandidates(cwd, decision) {
    const want = stems(decision.summary);
    const out = [];
    if (want.size === 0)
        return out;
    for (const rel of RULE_DOCS) {
        const full = join(cwd, rel);
        if (!existsSync(full))
            continue;
        const content = readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed || /^#/.test(trimmed) || /^```/.test(trimmed) || /^<!--/.test(trimmed))
                continue;
            const lineStems = stems(trimmed);
            let shared = 0;
            for (const s of lineStems)
                if (want.has(s))
                    shared++;
            if (shared < MIN_SHARED_STEMS || shared / Math.min(want.size, lineStems.size) < MIN_OVERLAP_RATIO)
                continue;
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
    if (args.includes('--latest'))
        return decisions.length ? decisions[decisions.length - 1] : null;
    const hash = args.find((a) => !a.startsWith('--'));
    return hash ? decisions.find((d) => d.hash === hash) ?? null : null;
}
function describe(cwd, d, ledger) {
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
export const RECONCILE_DIRECTIVE = 'Read references/decision-reconciliation.md and apply its capture-time branch to each candidate: rewrite and commit a clear contradiction, write an ambiguous one to the pending record with reconcile pending. Never ask from this surface.';
/** Directive for the most recently logged decision, or null when nothing needs judging. */
export function reconcileDirectiveForLatest(cwd) {
    if (isDisabled(cwd))
        return null;
    const decisions = readDecisions(cwd);
    if (!decisions.length)
        return null;
    const d = decisions[decisions.length - 1];
    const r = describe(cwd, d, readLedger(cwd));
    if (!r.modelNeeded)
        return null;
    return { candidates: r.candidates, decisionHash: r.decisionHash, directive: RECONCILE_DIRECTIVE };
}
// ─── handlers ───────────────────────────────────────────────────────────────
export const reconcileCandidates = async (args, projectDir) => {
    if (isDisabled(projectDir)) {
        return { data: { skipped: true, reason: 'workflow.decision_reconciliation is false', candidates: [], modelNeeded: false } };
    }
    const d = pickDecision(readDecisions(projectDir), args);
    if (!d) {
        return { data: { decisionHash: null, decisionText: null, candidates: [], ledgerOutcome: null, modelNeeded: false, reason: 'decision not found' } };
    }
    return { data: describe(projectDir, d, readLedger(projectDir)) };
};
export const reconcileSweep = async (_args, projectDir) => {
    if (isDisabled(projectDir)) {
        return { data: { skipped: true, reason: 'workflow.decision_reconciliation is false', decisions: [], count: 0 } };
    }
    const ledger = readLedger(projectDir);
    const decisions = readDecisions(projectDir)
        .filter((d) => !ledger.entries[d.hash])
        .map((d) => describe(projectDir, d, ledger));
    return { data: { decisions, count: decisions.length } };
};
export const reconcileRecord = async (args, projectDir) => {
    const hash = args.find((a) => !a.startsWith('--'));
    const oIdx = args.indexOf('--outcome');
    const outcome = oIdx !== -1 ? args[oIdx + 1] : undefined;
    if (!hash)
        return { data: { error: 'decision hash required' } };
    if (!outcome || !RECONCILE_OUTCOMES.includes(outcome)) {
        return { data: { error: `--outcome must be one of ${RECONCILE_OUTCOMES.join(', ')}` } };
    }
    const ledger = readLedger(projectDir);
    const existing = ledger.entries[hash];
    let changed = false;
    if (!existing || existing.outcome !== outcome) {
        ledger.entries[hash] = { outcome, at: new Date().toISOString() };
        writeJsonAtomic(join(projectDir, LEDGER_REL), ledger);
        changed = true;
    }
    const pending = readPending(projectDir);
    const drained = Object.prototype.hasOwnProperty.call(pending.entries, hash);
    if (drained) {
        delete pending.entries[hash];
        writeJsonAtomic(join(projectDir, PENDING_REL), pending);
    }
    return { data: { recorded: true, hash, outcome, changed, drainedPending: drained } };
};
export const reconcilePending = async (args, projectDir) => {
    const d = pickDecision(readDecisions(projectDir), args);
    if (!d)
        return { data: { error: 'decision not found' } };
    const pending = readPending(projectDir);
    pending.entries[d.hash] = {
        decisionText: d.text,
        candidates: findCandidates(projectDir, d).map((c) => ({ file: c.file, ruleText: c.ruleText })),
    };
    writeJsonAtomic(join(projectDir, PENDING_REL), pending);
    return { data: { pending: true, hash: d.hash, total: Object.keys(pending.entries).length } };
};
//# sourceMappingURL=reconcile.js.map