# Upstream cherry-picks: deferred / parked items (internal)

Internal tracking of gsd-core upstream fixes that were evaluated and intentionally NOT
integrated, with the exact action to take when picked up later. Not user-facing (this file
is internal to `.planning/`). Cross-ref: `reference_cc_plugin_no_permissions` memory,
`260609-kb0-CHERRYPICK-CANDIDATES.md`.

Last updated: 2026-07-18 (v1.7.0 triage 260718-vhs).

## gsd-core v1.7.0 triage (260718-vhs, 2026-07-18)

Full assessment: `.planning/quick/260718-vhs-triage-upstream-gsd-core-1-7-0-claude-re/260718-vhs-FINDINGS.md`.
Provenance at time of triage: gsd-core 1.6.1. Most of v1.7.0 is multi-runtime (ADR-1239,
portability AST, SLURM, Gemini sunset) = out of scope for a Claude-only fork.

**ADOPT (shortlist for a Tier-1 correctness release):**
- #2018 empty-manifest agent-delete guard (CJS `surface.cjs`, port upstream test). S/low.
- #1581 config-set `Number.isFinite` + `project_code` string carve-out (both twins). S/low.
- #1988 pair *-SUMMARY.md to a PLAN before counting (both twins, golden fixtures). M/low.
- #1154+#1820 verifier `insufficient_spec` abstain (sub-reason of UNCERTAIN) + planner
  probe predicates into must_haves (agent md only). S-M/low.

**ADAPT (Tier-2 follow-ups):**
- #1779 quote/escape unsafe YAML scalars in reconstructFrontmatter (both twins; escape
  embedded `"`/`\`, leading indicators, reserved words; update golden). M/med.
- #1561 assumption-delta advisory checkpoint — STRICTLY advisory / auto-continue, no
  blocking pause, no new HANDOFF path. M/low-med.

**DECLINED (decided 2026-07-23, keep Option B):**
- #2022 gate update-plan-progress checkbox on verification passed. NOT adopting. The fork
  keeps its deliberate "warn, don't block" completion model: a phase can be marked complete
  with a verification warning, the maintainer stays in control. The genuinely-broken case
  this touched (a PAUSED plan wrongly ticking a phase complete) was already fixed by the #25
  status-aware-completion work (v4.2.2), so what remained in #2022 was a stricter policy, not
  a correctness gap. Do NOT re-raise unless the fork deliberately moves to verification-first
  completion as a milestone theme (which would require adding `readVerificationStatus` in both
  resolvers and gating BOTH `roadmap.update-plan-progress` AND `phase.complete`). Companion
  #2030/#2025/#1921 also decline with it.

**DEFERRED — do opportunistically:**
- #1729 phase-header pre-colon parenthetical. Distributed across ~4 CJS + 10+ SDK regexes;
  do WHEN centralizing the colon boundary into `phaseMarkdownRegexSource()` (`core.cjs:776`).
  Low urgency (our writers emit the parenthetical post-colon; only external roadmaps hit it).
- #1866 agent self-load of agent_skills. Marginal token payoff; adopt only bundled with a
  broader agent-spawn refactor. Touches `init.cjs` + `skills.ts` + the security resolver.

**SKIP (documented):**
- #1787 `/gsd:next` smart-entry menu. Name collision: `/gsd:next` is our advancement ENGINE
  (ahead of upstream's, has Route 0.5 partial-UAT invariant + spike notices); the menu role
  is already `/gsd:do`. Optional nugget: a no-typed-intent menu-mode bolt-on to `/gsd:do`.
  Do NOT drop upstream's next.md over ours.
- #1855 Claude marketplace manifest. ALREADY-HAVE (richer two-plugin manifest). Optional
  cosmetic: add `owner.url` / `author.url`. Sync-guard: don't let upstream's single `gsd-core`
  manifest clobber our two-plugin block.
- #2002+#2036 self-healing runtime build. Failure mode can't occur (we commit `bin/lib` +
  `sdk/dist` + `dist/bm`). Fork-native adaptation of the intent: extend `build-bm.cjs --check`
  dist-parity to also cover `bin/lib` and `sdk/dist`.
- #1143 claude-orchestration capability. Contradicts our `references/ultracode-mode.md`
  "signal not mechanism" finding. Spike to confirm whether #1143 wired a real plugin-driven
  Workflow backend before revisiting; else stays skipped.


## Status of the v1.3.1->v1.4.1 TIER-2 set
- #905, #904, #771, #25, #913 (TIER-1) -> shipped v3.4.1
- #892, #770 (TIER-2) -> shipped v3.4.1
- #925, #921/#922 (v1.4.2 follow-ups) -> shipped v3.4.2
- **#730** (TIER-2, multi-milestone Phase Details) -> shipped v3.4.3 (adapted)
- **#768** (TIER-2, CC permissions prepopulation) -> DEFERRED, see below

## #768 — CC permissions prepopulation (DEFERRED, doc-only when revived)

**Decision (2026-06-09): ignore for now, documented here for later.** The user opted not to
add it to the README yet.

**Verified blocker (do not retry the automatic path):** Claude Code plugins have NO supported
way to seed permission allow/deny rules. `plugin.json` has no `permissions` field (adding one
fails `claude plugin validate --strict`); a plugin-bundled `settings.json` ignores permissions;
rules are only read from the user's/project's own settings.json. Verified against CC docs
v2.1.154+ (claude-code-guide, 2026-06-09). Full detail in the
`reference_cc_plugin_no_permissions` memory.

**The only viable form** is a documented "recommended settings.json" snippet users paste into
`.claude/settings.json` (project) or `~/.claude/settings.json` (user). When/if we do it, drop
this into the README (adapt the Bash allow pattern to our tooling, NOT upstream's `npx gsd-core`):

```jsonc
{
  "permissions": {
    "allow": [
      "Read(.planning/*)",
      "Write(.planning/*)",
      "Read(STATE.md)",
      "Write(STATE.md)",
      "Bash(gsd-sdk *)",
      "Bash(gsd-tools *)"
    ],
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(.secrets)"
    ]
  }
}
```

Value if revived: no first-run approval prompts for the constant `.planning/`/`STATE.md`
read/writes + defense-in-depth `.env`/`.secrets` deny. It's doc-only (zero code), so it can ride
any future docs-catch-up patch bump. Verify the exact Bash command surface our hooks/tools use
before publishing the snippet (the `Bash(...)` patterns above are a first draft).

## Other intentionally-excluded upstream work (by design, not "deferred")
Multi-runtime emitters (Cline/Cursor/Copilot/Qwen/OpenCode/Kilo/Augment/Gemini/Codex/CodeBuddy),
release/CI/changeset infra, build-at-publish + SDK-retirement plumbing, and `commands/` changes
are out of scope for the flat CC-only plugin and are NOT tracked here. See the TIER-3 skip list
in `260609-kb0-CHERRYPICK-CANDIDATES.md`.
