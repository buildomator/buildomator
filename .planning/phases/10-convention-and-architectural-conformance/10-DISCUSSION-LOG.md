# Phase 10: Convention and Architectural Conformance - Discussion Log

> **Audit trail only.** Not consumed by planning/research/execution agents.
> Decisions captured in 10-CONTEXT.md.

**Date:** 2026-06-26
**Phase:** 10-convention-and-architectural-conformance
**Mode:** discuss (default)
**Areas discussed:** Convention scope + entropy, Finding severity/framing, Review coupling, Language coverage (all 4 selected)

## Q&A

### Area 1 - Convention scope + entropy
**Question:** When the codebase has no dominant convention for an axis (high entropy), what should pattern-mapper emit?
**Options:** Unconstrained + hotspot note (recommended) / Plurality wins / Unconstrained only
**Selected:** Unconstrained + hotspot note. Name a convention only at ~>=70% dominance; otherwise "author's choice" + list as contested hotspot. → D-01.

### Area 2 - Finding severity / framing
**Question:** How should code-review classify the new conformance / verb-vs-body / architectural-split findings?
**Options:** New advisory tier (recommended) / Fold into WARNING / Advisory but verb-vs-body warns
**Selected:** New advisory `CONVENTION` tier below WARNING, never blocks; all three checks advisory. → D-03.

### Area 3 - Review coupling
**Question:** How should code-review obtain the derived convention at review time?
**Options:** Shared module both call (recommended) / Depend on PATTERNS.md / Re-derive independently
**Selected:** Single shared deterministic module in bin/lib; pattern-mapper and code-review both call it; reused by Phase 11 fallback. code-review stays standalone. → D-04.

### Area 4 - Language coverage
**Question:** What language scope for the deterministic checks in v1.3?
**Options presented:** JS/TS-first skip others (recommended) / Language-agnostic now / JS/TS only hard skip
**User response (Other):** "investigate how this is done by the inspirational project, prefer language-agnostic if feasible"
**Investigation:** Read 10-CONTEXT.md canonical refs. VibeDrift = MinHash on operation-sequences + LCS, TS/Node-focused; naming-drift generalizes but verb-vs-body and architectural-split are per-language idioms (research warned generic heuristics produce noise). Companion research picks web-tree-sitter (WASM, multi-language) + JS/TS grammars, markdown out of scope.
**Resolution:** Language-agnostic architecture (pluggable extraction), JS/TS rule packs first; casing axes (file-name, identifier) run language-agnostically; idiom checks skip gracefully where no rule pack exists. → D-05. Research flag for planner: whether a regex/no-AST fallback covers casing axes to avoid a WASM dependency.

## Todo cross-reference
2 low-confidence matches surfaced (`auto-accept-recommended-default-prompts` score 0.6, `collapse-plan-phase-upstream-gates` score 0.4). Both keyword coincidences, unrelated to consistency drift. NOT folded (D-06). Left in pending/.

## Deferred ideas
Phase 11 territory (sweep, VibeDrift gate, scan --drift, allowlist, audit-milestone gate, Type-4 semantic dup); consistency-relative security (future milestone); markdown instruction-dup (out of scope); non-JS/TS rule packs (architecture supports, packs deferred).
