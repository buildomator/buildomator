# Decision Reconciliation Guard, Design

- Date: 2026-11-03
- Status: Draft for approval (builder-check resolved, 2026-11-03)
- Repo: gsd-plugin (Buildomator)

## Intent and why

GSD records decisions into the decision log (STATE.md) and tracks them for coverage
against plans and shipped code (`check-decision-coverage`). But the documents that load
into every session as authority, the project `CLAUDE.md` and `PROJECT.md`, are never
reconciled against new decisions. So a decision can directly contradict a rule those
files still assert, and nothing notices. The contradiction ends up saved twice, in
different files, and the stale rule, being the one that loads every session, wins by
default. The agent then re-makes the same mistake session after session.

Observed failure (2026-10-25, a separate project): the user decided "enrol and invoice
are not a separate ask," and the decision was recorded correctly in STATE.md. But
`CLAUDE.md` and `PROJECT.md` still said "cohort enrolment requires approval first."
Every new session loaded the stale rule and re-introduced the gate the user had removed,
until the rule docs were hand-corrected and committed. STATE.md had been right the whole
time; the authority docs were the problem, and nothing was watching them.

The goal is a mechanism that, when a new instruction contradicts a held rule, either
reconciles it (clear case) or surfaces it (ambiguous, or session-start), instead of
silently keeping both.

## Goals

- Detect when a newly recorded decision contradicts a rule asserted in the project's
  authority docs (`CLAUDE.md`, `PROJECT.md`).
- Resolve it by firing point and confidence (matrix below), never by silently keeping
  both copies.
- Fire at two points: when the decision is recorded, and at session start for decisions
  recorded since the last sweep.
- Keep cost bounded: judge only new decisions, so a session with nothing new does no
  model work.
- Every automatic rewrite is a reversible commit the user can see and undo.

## Non-goals

- Not file-structure drift (that is `drift.cjs` and the VibeDrift-derived gates;
  unrelated kind of divergence).
- Not catching contradictions between arbitrary free-form chat turns. The trigger is the
  structured decision-record path, plus the session-start sweep.
- Not rewriting history: `ROADMAP.md` (what was planned) and `STATE.md` (the decision
  log) are never edited by this mechanism.
- Not editing the user's global `~/.claude/CLAUDE.md`; cross-project rules are never
  auto-rewritten, only flagged.
- Not editing a rule that lives inside an auto-managed block (for example the
  `generate-claude-profile`-owned Developer Profile section, marked do-not-edit) or an
  `@`-include. A contradiction whose stale rule sits there is surfaced for the user,
  never auto-rewritten, because editing it would collide with the owning generator.

## Anti-goals (a failure even if it technically works)

- Silently rewriting an authority doc in a way the user cannot easily see or undo.
- Re-flagging the same reconciled conflict every session. Noise makes the user stop
  reading it, and then it fails exactly like a stale reminder.
- Adding a model call to every session start whether or not anything changed (a cost
  regression, which is the opposite of why this came up).
- Auto-resolving an ambiguous conflict and picking the wrong side.

## Resolution policy (the matrix)

Two inputs: firing point, and the judge's confidence.

| Firing point | Clear contradiction | Ambiguous |
|---|---|---|
| At capture (user just gave the instruction) | Rewrite the stale rule in place, commit, tell the user. Non-blocking. | Stop and ask. Blocking. |
| Session-start sweep | Ask the user: surface the conflict with both texts and the proposed rewrite, apply on confirmation. | Ask the user. |

Rationale: at capture the user is present and just spoke, so a clear contradiction is
safe to auto-apply with a notice. At session start the new decision is from a past
session and the user is not yet oriented, so even a clear contradiction is surfaced for a
yes rather than applied silently (user's call, 2026-11-03).

## Mechanism (three stages)

1. Candidate retrieval, mechanical and cheap. Read the decision from the STATE.md
   decision log, which is the format `gsd_add_decision` / `stateAddDecision` writes and
   the one the observed failure involved, then reuse the normalized phrase matcher from
   `check-decision-coverage.ts` to find rules in `CLAUDE.md` / `PROJECT.md` on the same
   topic. Note: `parseDecisions` / `decisions.ts` targets CONTEXT.md `D-NN` blocks, a
   different format, so the reusable piece is the matcher, not that parser. No model
   call. Produces a short candidate list, often empty.

2. Contradiction judgment, semantic. For each candidate, a model judgment returns:
   contradicts (yes/no), confidence (clear/ambiguous), the rule text in question, and a
   proposed rewrite of that rule that matches the decision. This is the only stage that
   spends tokens, and it runs only when stage 1 found a candidate.

3. Action, gated by the matrix. Apply-and-commit, or surface-and-ask. Rewrites obey the
   project writing rules (no em or en dashes, never the word "canonical"), quote the
   decision, and commit with a message naming the decision and its date.

## Architecture: who runs the judge

The semantic judge (stage 2), the in-place rewrite, and the stop-and-ask cannot run
inside a hook or a mutation handler: hooks and `stateAddDecision` are deterministic Node
code with no model access and no `AskUserQuestion` (see `gsd-auth-detector.js`, which
notes hooks cannot ask). So the guard is agent-driven. The mechanical parts (candidate
retrieval, watermark bookkeeping) run in Node; everything that needs the model, an edit,
a commit, or a question is performed by the main-session agent acting on a directive the
Node layer injects.

- Capture-time: the add-decision path, having found a candidate mechanically, injects a
  directive. The agent judges, and per the matrix either rewrites and commits (clear) or
  asks via `AskUserQuestion` (ambiguous).
- Session-start: the sweep writes a pending-conflict record and emits a `systemMessage`
  pointing the agent at it (a `systemMessage` is one-directional, so the record is the
  carrier). The agent drains the record, asks, and applies the rewrite on a yes. A
  dedicated entry point (for example `/bm:reconcile`) can host the drain-and-apply flow
  so it is also runnable on demand.

The judge runs as a normal agent turn, so it bills at the session's model_profile tier
(default balanced) and its edits pass through the repo's existing Edit/Write guards.

## Firing points

- At capture: hook the decision-record path (the add-decision mutation /
  `gsd_add_decision`). Before the decision settles, run stages 1 to 3. This is where a
  clear contradiction earns the silent rewrite plus notice.

- Session-start sweep: a check alongside `hooks/gsd-staleness-reminder.js`. It reads a
  watermark, runs stages 1 to 3 only on decisions newer than the watermark against the
  current rule docs, and surfaces any conflict through `systemMessage`, preferring to ask
  per the matrix. It advances the watermark when done.

## Watermark and ledger

A small persisted record (for example under `.planning/`) keyed by a normalized content
hash of each decision, holding the outcome per decision (reconciled-auto,
reconciled-asked, dismissed). Keying on content hash, not an id or timestamp, matters
because STATE.md decision-log entries carry neither a stable `D-NN` id nor a reliable
per-entry date and can be reordered or edited. Consequences: the sweep judges only
decisions whose hash is not yet in the ledger, so most session starts do zero model work;
a conflict the user dismissed or resolved is not raised again; and an edited decision
gets a new hash and is correctly re-judged. This needs no change to the decision-log
format or to `stateAddDecision`. Without the ledger, the sweep becomes a per-session cost
and noise sink, which is anti-goals 2 and 3.

## Constraints

- Two twins: any logic added to `bin/lib` (CJS) must land in `sdk/src` (TS) too, with a
  rebuild; config keys go in both schemas.
- `dist/bm` is generated by `build-bm` from the `gsd:`-namespaced source via the
  transform. Edit source only, regenerate, and `build-bm --check` must pass on a clean
  tree.
- Rewrites must respect the global user rules (no em or en dashes, never "canonical").
- Reversibility: every auto-rewrite is its own commit.
- The target authority file is the repo-root project `CLAUDE.md`, not a nested one and
  not the global file (the global file is flag-only, already a non-goal).
- The judge runs at a tier the user is willing to pay for at decision-rate frequency;
  default to the balanced profile's tier, not Opus.

## What is left to the builder

- The candidate-retrieval heuristic (topic-overlap threshold) and how wide it casts
  before the model judges (precision vs recall).
- The judgment prompt and its structured output contract.
- The watermark/ledger format and location, and how it relates to STATE.md.
- The session-start surfacing format: the `systemMessage` wording, how the user answers,
  and how an answer applies the rewrite.
- Whether capture-time integrates as a hook on the mutation or inside the mutation
  handler itself.
- Tests: a golden fixture of the 2026-10-25 enrolment case (stale `CLAUDE.md` rule plus
  contradicting decision, expect the clear-contradiction path), an ambiguous case
  (expect the ask path), and a no-candidate case (expect no model call).
