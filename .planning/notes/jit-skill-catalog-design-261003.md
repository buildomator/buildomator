# Just-in-time external skill catalog (design note)

Date: 2026-10-03
Status: design draft, not scheduled. Pairs with the Agent Skills spec upstream todo.

## Problem

Two forces pull in opposite directions:

1. Buildomator ships 86 plugin skills. Every skill's `name` + `description` loads
   at startup (Agent Skills progressive-disclosure tier 1), so the command set is
   an always-on context tax paid on every `/bm:` invocation. This already strains
   `feedback_minimize_workflow_tokens`. Growing the set linearly grows the tax.
2. skills.sh (Vercel registry, ~1.5M installs) and the official Anthropic set carry
   real domain craft Buildomator lacks: document generation (docx/pdf/pptx/xlsx),
   SEO, Playwright e2e, deeper security tooling, framework packs. Installing these
   as plugin skills would both blow up the startup tax and pull untrusted
   third-party instructions into the command namespace.

We want the craft without the sprawl.

## Layer model (why overlap is thin)

Buildomator skills are the PROCESS layer (plan, phase, milestone, UAT, debug,
workspaces). skills.sh skills are the CRAFT layer (how to do SEO, e2e, refactor,
a framework). They rarely duplicate. Where they touch, the external skill ENRICHES
a Buildomator agent rather than replacing a Buildomator skill:

| Buildomator (process)                   | External (craft)                              | Relation |
| --------------------------------------- | --------------------------------------------- | -------- |
| secure-phase / bm-security-auditor      | Trail of Bits, security-review (CodeQL/Semgrep) | enrich |
| add-tests / bm-executor                 | playwright-e2e-testing, tdd                   | enrich   |
| ui-phase / ui-review / sketch           | frontend-design                               | enrich   |
| code-review-fix / map-codebase          | refactor, improve-codebase-architecture       | enrich   |

Pure gaps (nothing in the 86): docx/pdf/pptx/xlsx, Claude SEO, Playwright craft,
framework packs (React/Next/Supabase/Prisma/Azure), browser automation.

## Design: catalog + propose-vs-insert

The craft layer stays OUT of the installed set. It lives in a curated catalog that
costs nothing until a task enters its domain.

1. Catalog: a short, curated `skills-catalog` keyed by domain/trigger. Each entry
   pins a specific skill at a specific commit, with source URL, install-count
   signal, and a trust tier. This is a vetted shortlist, NOT a mirror of the
   registry. The catalog is the new artifact to maintain; skills.sh and the Agent
   Skills spec are what we watch for catalog updates (VibeDrift-style release
   watch).
2. Propose on FIT (model, auto, cheap): when a phase or quick-task scope matches a
   catalog trigger (SEO work detected, an e2e phase, a .docx deliverable), the
   workflow surfaces the candidate(s): "this domain has a vetted skill X; insert it
   for this phase?" The model is good at relevance; use it only for relevance.
3. Gate insertion on TRUST (structural + human, NOT model-vouched): the model must
   not read a third-party SKILL.md and vouch for its safety, because reading it is
   already ingesting untrusted instructions (prompt-injection vector). The trust
   gate is structural: publisher/author allowlist, `skills-ref validate` pass, a
   scan or outright ban of bundled `scripts/`, a pinned commit (never floating
   HEAD), and a one-time human approve on first insertion.
4. Insert: on accept, write a project-scoped `agent_skills.<agent>` entry, gated by
   the existing `trusted_global_roots` allowlist, and record the insertion (pinned
   commit) in `.planning` so the run stays reproducible and auditable.

The whole insertion path already exists: `agent_skills` injection into agents,
`global:<name>` / `global:<plugin>:<skill>` forms, and the strict
`trusted_global_roots` allowlist. This feature adds the catalog + the
propose/assess gate on top; it does not loosen the security default and does not
build a runtime auto-installer.

## Mess guardrails

- Catalog is a curated shortlist per domain, not a registry mirror.
- External craft skills never enter the `/bm:` command namespace; they are
  agent_skills injections only.
- Pin commits and record insertions so behavior is reproducible, not dependent on
  external state drifting under a run.
- Separate FIT (model proposes) from SAFETY (structural + human gate).

## Scope

Bigger than a quick task: catalog format, propose/assess gate, trust pipeline,
skills.sh/spec watch. A spec'd phase or small milestone. Pairs with adding the
Agent Skills spec as the 5th idea-only upstream, which also supplies
`skills-ref validate` for the trust gate.

See [[token-lean-sdk-query]] (startup/token cost lever), the
`add-more-programming-language-rule-packs` todo (sibling craft-coverage work),
`.planning/upstream-deferred.md` (upstream watch list), and
`feedback_gsd_scope_asymmetry` (addition paths outnumber retirement paths: give
the catalog a size ceiling and a prune step).

## Licensing gate (added 2026-10-04)

License is a mandatory structural axis of the insertion gate, on the same footing as
safety. We REFERENCE, never redistribute: Buildomator stores metadata + a pinned
commit; the user fetches the skill from its source. Caching or vendoring a
third-party skill into Buildomator's repo is forbidden (it would make us a
redistributor and inherit the source's obligations).

Per entry: record the SPDX id + a one-line obligation summary, surface both at the
insert prompt, store in `.planning` for provenance.

Gate policy:
- Allow: OSI permissive (MIT, Apache-2.0, BSD, ISC).
- Flag / human-decide: copyleft (GPL/AGPL, since a bundled script copied into the
  user's tree can create obligations) and source-available.
- Block by default: no license file (= all rights reserved), unknown, non-commercial,
  proprietary without reviewed terms. Same posture as unknown-safety.

Bundled tooling carries its own license independent of the skill's (for example
CodeQL has restrictive terms for some commercial automated use). Check both.

Trademark: label vendor skills factually ("published by Vercel Labs"); never imply a
vendor endorses Buildomator.

### v1 source licenses (verified 2026-10-04)
- SEO (coreyhaines31/marketingskills): MIT. Catalog-eligible.
- DuckDB (duckdb/duckdb-skills): MIT. Catalog-eligible.
- Docgen (anthropics/skills docx/pdf/pptx/xlsx): BLOCKED. `skills/docx/LICENSE.txt`
  is "(c) 2025 Anthropic, PBC. All rights reserved." Use is governed by your Anthropic
  service agreement; users may not extract/retain copies outside the Services,
  reproduce/copy, create derivative works, or distribute/sublicense to third parties.
  Not third-party-catalog-eligible. v1 docgen approach: rely on Claude Code's built-in
  first-party document skills (using them inside Claude Code is authorized Service
  use), consistent with the Claude-Code-only directive; do not catalog or redistribute
  them. Fallback if portability is ever needed: author an MIT Buildomator skill over
  OSS libraries (python-docx / openpyxl / python-pptx / reportlab).

This finding validates the gate: the highest-value gap's default source was caught and
rejected on license before shipping.

## Sources

- skills.sh (https://www.skills.sh/) registry + install channel.
- anthropics/skills (https://github.com/anthropics/skills) official doc skills + spec + template.
- Agent Skills spec (https://agentskills.io/specification) SKILL.md contract + skills-ref validator.
