# Upstream gsd-core 1.6 Survey

**Task:** Identify what is new in gsd-core 1.6 and judge which changes are worth cherry-picking.

---

## (a) Current upstream version

**Confirmed latest: `v1.6.0`**, released 2026-06-24.

Sources checked:
- `gh release list -R open-gsd/get-shit-done-redux` — shows `v1.6.0` as "Latest", published 2026-06-24T22:38:37Z.
- `npm view @opengsd/gsd-core dist-tags` — latest = `1.6.0`.
- CHANGELOG.md via `gh api repos/open-gsd/get-shit-done-redux/contents/CHANGELOG.md` — section `## [1.6.0] - 2026-06-24` is the top released block.

RC chain: rc.1 (2026-06-20), rc.2 (2026-06-22), rc.3 (2026-06-24), final (2026-06-24).

---

## (b) New in 1.6 vs 1.5 — themed table with fit verdicts

| # | Item | Theme | ADOPT / ADAPT / SKIP | Reason |
|---|------|-------|----------------------|--------|
| 1 | `workflow.context_guard_mode` — proactive context-exhaustion guard for `execute-phase` (warn/auto/off) | Execute reliability | **ADAPT** | Directly useful for Claude Code; the `warn` default is low-cost. Needs porting to plugin's execute-phase skill (flat layout). Token overhead: one self-assessment message per wave at POOR tier, negligible. |
| 2 | `execute-phase` re-checks worktree fork base + resets wave manifest between waves (#1369) | Execute reliability | **ADOPT** | Concrete bug fix: wave N+1 was forked from stale base causing immediate fatal halt; manifest was reused across waves. Pure correctness, no token cost. Plugin uses worktrees — directly applicable. |
| 3 | `mktemp` BSD/macOS randomization fix — `XXXXXX` must be path-final; affects `execute-phase`, `quick`, `spec-phase`, `ship`, `profile-user` (#1520) | macOS correctness | **ADOPT** | Plugin targets macOS (darwin) per env. Concurrent wave runs on macOS will collide on temp files without this. Small targeted fix. |
| 4 | `frontmatter set/merge` preserves `must_haves` object-lists (#1572) | Data-loss prevention | **ADOPT** | Silent data-loss: changing `wave` field drops all `provides:` values and collapses `must_haves.artifacts/prohibitions`. Affects any phase using must_haves (plugin's NYQ gates use these). |
| 5 | Core-path file locks: PID-liveness probe before stealing (#1532) | Data-loss prevention | **ADOPT** | STATE.md write lock and `.planning/` workspace lock stole on bare mtime, risking STATE.md corruption on slow FS. The plugin's checkpoints rely on STATE.md integrity. No token cost. |
| 6 | `findProjectRoot` walks up to nearest ancestor `.planning/` (#1414) | Config resolution | **ADOPT** | Fixes cwd-drift gap #1366 — config resolved to defaults when invoked from a subdirectory. Plugin's hooks call gsd-tools; this fixes silent mis-configuration. Small CJS change. |
| 7 | `gsd-tools query agent-skills` anchors to project root via `findProjectRoot` (#1415) | Config resolution | **ADOPT** | Companion fix to #1414: agent-skills silently dropped configured skills when invoked outside root. Closes observable bug #1366. Plugin's two CJS resolvers both call this. |
| 8 | `verify-work` now routes UAT deterministically from structured `coverage:` block on SUMMARY.md (#1602) | Workflow quality | **ADAPT** | Deliverables with passing automated tests are auto-passed; judgment-only ones presented to human. Real UX improvement. Requires SUMMARY.md to have `coverage:` block (authored by execute-plan); fallback to prose for old summaries is byte-identical. Worth porting to plugin's verify-work skill. |
| 9 | `plan:pre` codebase-drift pre-check before planner runs (#1592) | Planning quality | **ADAPT** | Stale STRUCTURE.md surfaced before planner, not mid-execution. Requires `workflow.plan_drift_precheck` toggle (default on). The plugin already has drift detection (Phase 11 / VibeDrift). Check for overlap before porting. |
| 10 | `workflow.mvp_mode`, `code_review_command`, `plan_chunked` added to `VALID_CONFIG_KEYS` (#1494) | Config schema | **SKIP** | Keys already existed in planning-pipeline code. Plugin doesn't expose `config-set` UI; these are internal upstream housekeeping. |
| 11 | `gap-analysis --phase-req-ids` expands numeric ID ranges `SEL-01..SEL-03` (#1269) | Gap analysis UX | **ADAPT** | Nice QoL: `SEL-01..SEL-03` → `SEL-01, SEL-02, SEL-03` in gap-analysis. Pure additive, no token cost. Medium effort to port (gsd-tools.cjs change). |
| 12 | `/gsd:review` requires external reviewers to verify plan claims against source (#1318) | Review quality | **ADAPT** | Makes agentic reviewers cite `file:line` evidence. Adds ~2 lines to review skill prompt. Additive, low overhead. |
| 13 | `gsd-capture --list-seeds` audits parked seeds (#441) | UX feature | **SKIP** | seeds are a niche feature; `plant-seed` skill exists in plugin but this is upstream-specific CLI surface. Low priority. |
| 14 | Capability Registry system (ADR-1244 Phases 1-5): versioned manifests, runtime overlay, source resolver, ledger, trust gate, CLI install/update/remove/list/disable/enable/outdated (#1436-1488) | Multi-runtime infra | **SKIP** | Full Capability Registry is the major 1.6 theme. Designed for multi-runtime third-party plugin discovery. Plugin is Claude Code only, already ships capabilities differently (plugin.json). Zero value, high complexity. |
| 15 | Plugin installs now expose GSD skills via `.claude-plugin/plugin.json` (#1596) | Plugin install | **SKIP** | Plugin already ships via `plugin.json` with Claude Code only. Upstream's mechanism targets the new descriptor-driven install path not used by gsd-plugin. No-op. |
| 16 | Resolution Provenance system — `Resolution<T>` envelope, ADR-1411, provenance reporting (#1416, #1425) | Internal refactor | **SKIP** | Internal IR change for multi-runtime config diagnostics. Plugin doesn't expose this surface. High refactor cost, no user value. |
| 17 | Markdown-sectionizer seam refactor (epic #1372 T0-T7) — ADR/roadmap/UAT/state parsers migrated | Internal refactor | **SKIP** | Large internal refactor to reduce ad-hoc markdown parsing. Correct direction but risky to cherry-pick piecemeal across the plugin's independently-managed CJS layer. |
| 18 | Agent converter descriptor-driven install path (8 agent converters, #1173) | Multi-runtime | **SKIP** | Multi-runtime agent conversion (Gemini, Codex, Windsurf). Claude Code only — entirely irrelevant. |
| 19 | fish-shell PATH suggestion (#323) | Install UX | **SKIP** | Plugin install doesn't run the upstream install.js shell PATH suggester on Claude Code. No-op. |
| 20 | Windsurf slash workflow installs / cleanup (#1615, #1629-1631) | Multi-runtime | **SKIP** | Windsurf-specific. Irrelevant. |
| 21 | `normalizeNodePath` mise shim fix (#1619) | Hook reliability | **ADAPT** | Fixes hooks silently failing when mise prunes the versioned node path. The plugin ships managed hooks (SessionStart, tool events) that bake `process.execPath`. Worth checking if plugin's `bash-hook` wrapper is already immune. |
| 22 | `_deepMergeConfig` prototype-pollution guard (#1534) | Security | **ADOPT** | Low-effort security fix: config.json with `__proto__` key could spoof unset flags. Direct CJS change. |
| 23 | `byPhaseTablePattern` CRLF-tolerant STATE.md table parsing (#1658) | Cross-platform correctness | **SKIP** | CRLF STATE.md is a Windows concern. Plugin targets macOS/darwin. Low priority. |
| 24 | `phases clear` refuses to delete phase dirs with uncommitted changes (#1447) | Data-loss prevention | **ADAPT** | Guard against data loss at `new-milestone` time. Plugin's `cleanup` skill calls phase ops. Worth porting if plugin exposes `phases clear`. |
| 25 | `roadmap upgrade rollback` restores `.planning` regardless of git tracking (#1542) | Reliability | **SKIP** | Upstream roadmap upgrade tool. Plugin doesn't ship `gsd roadmap upgrade` directly. |
| 26 | `WebFetch/WebSearch injection isolation + opt-in blocking` (#1577) | Security | **ADAPT** | Isolates web-fetching agents from injecting malicious content into the workflow. Additive opt-in. If plugin's research/ai-integration phases use WebFetch, relevant. Check overlap with existing tool grants. |
| 27 | `validate health` workstream-aware paths + W017 active-worktree exclusion (#1472, #1454) | Health checks | **ADOPT** | W017 was incorrectly flagging the current session's worktree for removal. Low-risk targeted fix, directly applicable if plugin uses `gsd-tools validate health`. |
| 28 | 999.x backlog excluded from `total_phases`; `total_phases` can correct downward (#1445, #1446) | Progress accounting | **ADOPT** | Plugin uses backlog phases (999.x) in ROADMAP. These inflated total_phases and were non-correctable. Real user-visible bug. |
| 29 | `platformWriteSync` retries transient rename locks (#1540) | File I/O reliability | **ADOPT** | Prevents truncating readers on transient rename lock. Relevant for plugin's STATE.md writes. Small CJS fix. |
| 30 | `parseDecisions` handles titled-colon bullet form (#1639) | Decision parsing | **ADOPT** | Plugin's decision tracking uses this parser. Additive format support, zero risk. |

---

## (c) Ranked shortlist — top candidates

**Rank 1 — execute-phase wave-base + manifest reset (#1369)**
- ADOPT. Concrete multi-wave bug: wave N+1 forks from stale base, halts immediately. Plugin uses worktrees. Fix is ~10 lines in execute-phase skill (bash, find the "For each wave" loop, add step 0.5 base-check and step 7c unset). Effort: low (1-2h).

**Rank 2 — frontmatter must_haves preservation (#1572)**
- ADOPT. Silent data-loss on any `gsd-tools frontmatter set` call that touches `wave` while `must_haves` is populated. Plugin's Nyquist gates write must_haves. Fix is in the CJS layer; needs gsd-tools.cjs rebuild. Effort: medium (2-3h including test).

**Rank 3 — mktemp macOS fix (#1520)**
- ADOPT. Platform-specific (darwin). Affects execute-phase, quick, spec-phase, ship, profile-user — all use mktemp with suffixed templates. Concurrent runs on macOS collide without it. Small bash sed across 5 skills. Effort: low (1h).

**Rank 4 — 999.x backlog exclusion from total_phases (#1445/#1446) + PID-liveness lock fix (#1532) + prototype-pollution guard (#1534)**
- ADOPT as a bundle. All three are small, safe CJS fixes. Plugin has 999.x backlog phases in its ROADMAP; STATE.md corruption on slow lock steal is a real risk; prototype-pollution is a low-effort security win. Effort: medium (2-3h for all three).

**Rank 5 — context_guard_mode for execute-phase (#1452)**
- ADAPT. Useful for autonomous long-running phases. Adds a self-assessment check before each wave. Porting needs: (a) add the config key to plugin's valid config schema, (b) wire the wave-pre self-assessment in execute-phase skill. Effort: medium (3-4h).

---

## (d) Verification gaps

- The upstream repo is `open-gsd/get-shit-done-redux` but GitHub release URLs point to `open-gsd/gsd-core` — both appear to be the same project under a renamed repo. All data confirmed via `gh` CLI and npm.
- The full CHANGELOG section for 1.6.0 is ~59KB. The "Fixed" section has many small entries; the above table covers all notable ones from the full release notes dump. A handful of inline-formatted fix entries (without bold headers) may have been lightly summarized.
- Could not inspect actual source code diffs for #1369 and #1532 to verify exact line counts — effort estimates are based on the CHANGELOG prose descriptions.
- The `WebFetch/WebSearch injection isolation` (#1577) description is brief; the actual scope (whether it's a workflow prompt change or a hook-level guard) was not verified by reading the PR diff.
