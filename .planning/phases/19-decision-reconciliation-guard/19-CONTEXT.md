# Phase 19: Decision Reconciliation Guard - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Source:** PRD Express Path (docs/superpowers/specs/2026-11-03-decision-reconciliation-guard-design.md)

<domain>
## Phase Boundary

Build a guard that detects when a newly recorded STATE.md decision contradicts a rule
asserted in the project `CLAUDE.md` or `PROJECT.md`, and reconciles or surfaces it
instead of silently keeping both. Two firing points (capture-time and a session-start
sweep) and a confidence-gated resolution. Ships across both the CJS (`bin/lib`) and SDK
(`sdk/src`) twins with `dist/bm` regenerated. Delivers RECON-01 through RECON-07.

Out of this phase: file-structure drift (already `drift.cjs`), contradictions between
arbitrary free-form chat turns, and any rewrite of ROADMAP.md / STATE.md / the global
`~/.claude/CLAUDE.md`.
</domain>

<decisions>
## Implementation Decisions

Everything below is a LOCKED decision from the approved spec and its builder-check.

### Resolution policy (firing point x confidence)
- Capture-time, clear contradiction: rewrite the stale rule in place, commit as its own
  revertible commit, notify the user, do not block.
- Capture-time, ambiguous: stop and ask which rule wins before anything changes.
- Session-start sweep: always ask (surface both texts plus the proposed rewrite, apply on
  confirmation), never a silent rewrite, regardless of confidence.

### Architecture (agent-driven)
- Hooks and the `add-decision` mutation handler are deterministic Node with no model
  access and no AskUserQuestion; they do only the mechanical parts (candidate retrieval,
  ledger bookkeeping) and inject a directive.
- The model judgment, the rewrite/commit, and the ask are performed by the main-session
  agent acting on that directive. The judge runs as a normal agent turn at the session's
  model_profile tier (balanced default), and its edits pass through the repo's Edit/Write
  guards.
- Capture-time: the add-decision path finds a candidate mechanically, then injects a
  directive for the agent to judge and act.
- Session-start: a check alongside `hooks/gsd-staleness-reminder.js` writes a
  pending-conflict record and emits a `systemMessage` pointing the agent at it (the
  message is one-directional, so the record is the carrier). An on-demand entry point
  (for example `/bm:reconcile`) can host the drain-and-apply flow.

### Mechanism (three stages)
1. Candidate retrieval: read the decision from the STATE.md decision log (the format
   `gsd_add_decision` / `stateAddDecision` writes), then reuse the normalized phrase
   matcher from `check-decision-coverage.ts` to find same-topic rules in CLAUDE.md /
   PROJECT.md. `parseDecisions` / `decisions.ts` targets CONTEXT.md `D-NN` blocks, a
   different format, so reuse the matcher, not that parser. No model call.
2. Contradiction judgment: for each candidate, the agent returns contradicts (yes/no),
   confidence (clear/ambiguous), the rule text, and a proposed rewrite. Runs only when a
   candidate exists.
3. Action: gated by the matrix above. Rewrites obey the project writing rules (no em or
   en dashes, never "canonical"), quote the decision, commit naming the decision and date.

### Ledger (watermark)
- A small persisted record (for example under `.planning/`) keyed by a normalized content
  hash of each decision, holding the outcome per decision (reconciled-auto,
  reconciled-asked, dismissed).
- Keyed by content hash, not an id or timestamp, because STATE.md decision-log entries
  have neither a stable `D-NN` id nor a reliable per-entry date and can be reordered or
  edited. An edited decision gets a new hash and is correctly re-judged. No change to the
  decision-log format or to `stateAddDecision`.
- The sweep judges only decisions whose hash is not yet in the ledger, so a session with
  no new decisions does no model work; a dismissed or resolved conflict is not re-raised.

### Target docs and safety
- Auto-rewrite only the repo-root project `CLAUDE.md` and `PROJECT.md`.
- Never auto-rewrite ROADMAP.md, STATE.md, the global `~/.claude/CLAUDE.md`, or a rule
  inside an auto-managed block (for example the `generate-claude-profile`-owned Developer
  Profile section, marked do-not-edit) or an `@`-include. Such conflicts are surfaced for
  the user instead.

### Twin + build discipline
- All logic lands in BOTH the CJS (`bin/lib`) and SDK (`sdk/src`) twins, with config keys
  in both schemas. Regenerate `dist/bm`; `node bin/build-bm.cjs --check` must PASS on a
  clean tree.

### Claude's Discretion
- Candidate-retrieval topic-overlap threshold (precision vs recall).
- The judgment prompt and its structured output contract.
- The ledger file format and exact location, and how it relates to STATE.md.
- The session-start surfacing wording and how an answer applies the rewrite.
- Whether capture-time integrates as a hook on the mutation or inside the handler.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec (authority)
- `docs/superpowers/specs/2026-11-03-decision-reconciliation-guard-design.md` — the full approved design and its resolution matrix, architecture, ledger, and constraints.

### Analog / integration files (from the builder-check)
- `sdk/src/query/check-decision-coverage.ts` — the normalized phrase matcher to reuse for candidate retrieval; also the shape of a "decision check" handler.
- `sdk/src/query/decisions.ts` — the existing decision parser (CONTEXT.md `D-NN` format; NOT the STATE.md log format, so a separate reader is needed).
- `sdk/src/query/state-mutation.ts` — `stateAddDecision` (~line 841), the capture-time write path to the STATE.md decision log.
- `bin/lib/state.cjs` — the CJS twin of the state mutation / decision-log handling.
- `bin/lib/drift.cjs` — the existing (file-structure) drift engine; a sibling pattern, deliberately pure Node, NOT the host for this feature.
- `hooks/gsd-staleness-reminder.js` — the SessionStart hook the sweep sits beside; the `systemMessage` emission pattern.
- `hooks/gsd-auth-detector.js` — confirms hooks cannot call the model or AskUserQuestion (why the architecture is agent-driven).
- `bin/lib/config-schema.cjs` and `sdk/src/query/config-schema.ts` — both twins, where any new config keys must be registered.

</canonical_refs>

<specifics>
## Specific Ideas

- Golden test fixtures to include (from the spec): (1) the 2026-10-25 enrolment case, a
  stale CLAUDE.md rule plus a contradicting decision, expecting the clear-contradiction
  path; (2) an ambiguous case expecting the ask path; (3) a no-candidate case expecting
  no model call.
- Twin parity: expect a cross-twin test proving the CJS and SDK candidate-retrieval and
  ledger behavior agree, in the style of the existing parity tests.
</specifics>

<deferred>
## Deferred Ideas

- An on-demand `/bm:reconcile` command is optional polish; the two automatic firing
  points are the committed scope. Include it only if it falls out cheaply from the
  session-start drain-and-apply flow.
- Reconciling decisions against each other (decision-vs-decision) rather than
  decision-vs-rule is out of scope for this phase.

</deferred>

---

*Phase: 19-decision-reconciliation-guard*
*Context gathered: 2026-11-03 via PRD Express Path*
