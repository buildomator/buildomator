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
import type { QueryHandler } from './utils.js';
export type ReconcileOutcome = 'reconciled-auto' | 'reconciled-asked' | 'dismissed';
export declare const RECONCILE_OUTCOMES: readonly ReconcileOutcome[];
export interface DecisionEntry {
    hash: string;
    text: string;
    summary: string;
}
export interface Candidate {
    file: string;
    ruleText: string;
    autoRewritable: boolean;
    surfaceReason: string | null;
}
export declare function contentHash(text: string): string;
/** Parse the Decisions section bullets (`- [Phase N]: summary<sep>rationale`). */
export declare function parseDecisionLog(stateContent: string): DecisionEntry[];
/**
 * Safety gate: only the repo-root CLAUDE.md and PROJECT.md are auto-rewritable.
 * `line` is the 0-based line index inside `content`.
 */
export declare function assessTargetDoc(path: string, content: string, line: number, projectDir?: string): {
    autoRewritable: boolean;
    surfaceReason: string | null;
};
export declare const RECONCILE_DIRECTIVE = "Read references/decision-reconciliation.md and apply its capture-time branch to each candidate: rewrite and commit a clear contradiction, write an ambiguous one to the pending record with reconcile pending. Never ask from this surface.";
/** Directive for the most recently logged decision, or null when nothing needs judging. */
export declare function reconcileDirectiveForLatest(cwd: string): {
    candidates: Candidate[];
    decisionHash: string;
    directive: string;
} | null;
export declare const reconcileCandidates: QueryHandler;
export declare const reconcileSweep: QueryHandler;
export declare const reconcileRecord: QueryHandler;
export declare const reconcilePending: QueryHandler;
//# sourceMappingURL=reconcile.d.ts.map