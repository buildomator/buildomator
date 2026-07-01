---
quick_id: 260701-gbo
type: upstream-followups
date: 2026-07-01
status: complete
---

# Upstream follow-ups (2026-07-01) — 1.6.1 survey, 1.7.0-rc.1 read, VibeDrift watcher fix

Three parallel efforts off the "check upstream" status. gsd-core stable = 1.6.1
(2026-07-01); next = 1.7.0-rc.1. VibeDrift npm latest = 0.14.8 (our port baseline 0.14.0).

## 1. gsd-core 1.6.1 (patch on 1.6.0) — worth a small cherry-pick

Single PR train; confirmed via `gh compare v1.6.0...v1.6.1`.

| Item | Verdict | Note |
|------|---------|------|
| **#1580** exclude Phase 0 / Phase 999 sentinels from `milestone complete` guard + `roadmap analyze` (`milestone.cts`, `roadmap.cts`) | **ADOPT** | Small self-contained correctness; matches our sentinel/phase weak spots. We use 999.x backlog phases. |
| **#1591** `phase.complete` recognizes checkbox + bold-checkbox phase forms in `isLastPhase`, fixing false "Milestone complete" on `<details>`-wrapped checklists (`phase.cts`) | **ADOPT** | Directly hits our explore-milestone `<details>` discoverability gotcha ([[reference_explore_milestone_phase_discoverability]]). |
| **#1847** Sonnet standard tier -> `claude-sonnet-5` (was `claude-sonnet-4-6`) | **ADAPT + VERIFY** | Do NOT trust upstream's model id blindly — confirm `claude-sonnet-5` is a real released Anthropic model first. If real and we still pin Sonnet, propagate into BOTH CJS + SDK resolvers ([[reference_model_resolver_single_source]]); do NOT take upstream catalog.json wholesale (Registry-coupled). |
| **#1693** don't double-quote `$CLAUDE_PROJECT_DIR`-anchored hook paths on win32 | **VERIFY-then-maybe** | Relates to our Cygwin bash-hook fix (936a01f). Only port if our flat hook layout emits that anchor form. |

**#1520 companion:** NONE. No follow-up to the mktemp fix; nothing further needed.

**Recommendation:** a small "gsd-core 1.6.1 correctness slice" cherry-pick — #1580 + #1591 (both `.cts`, both hit known weak spots). #1847 gated on verifying the model id is real. Not urgent; does not block v4.1.

## 2. gsd-core 1.7.0-rc.1 (pre-release, forward read)

Mostly another cycle to sit out; a few Claude-relevant wins to grab when it stabilizes.

| Theme | Verdict |
|-------|---------|
| ADR-1239 multi-runtime host-integration (HostIntegrationInterface, embedding/model adapters, 16-runtime golden-parity harness, `gsd-mcp-server` bin) | **SKIP** — continuation of the Capability Registry / multi-runtime infra we already rejected; the bulk of the release |
| Cross-platform portability AST rules (ESLint AST rules replacing regex ratchets; Windows path/lock fixes) | **SKIP** (mostly) — upstream-repo tooling / multi-OS install, not our runtime |
| ADR-1769 STATE.md Transition Module (consolidated mutation seam + `cmdStateRebuild` + `current_phase_name` preserve #1695) | **MAYBE-ADOPT-LATER / WATCH** — touches our #9 state-handler-preservation area; large SDK refactor, high port cost |
| Small wins: verifier honest-abstain (#1154), assumption-delta checkpoint (#1561), custom reviewer instances (#1517), CLI version-skew warning (#1754), checkbox-list phase detection (#1591), search-provider config keys (#1747) | **WATCH** — best candidates: verifier-abstain, assumption-delta, checkbox-list |

**Verdict:** sit out the multi-runtime bulk; revisit the handful of correctness/UX wins when 1.7 ships stable; watch ADR-1769 against our issue #9 work.

## 3. VibeDrift watcher lag — FIXED (commit 1b3dbd7)

**Root cause:** `bin/check-vibedrift-release.sh` hardcoded `NPM="/usr/bin/npm"`, which does not exist on Homebrew macOS. Under cron's minimal PATH, `$NPM view ... || exit 0` bailed before the version compare every run → frozen at 0.14.4 while npm latest was 0.14.8. (The gsd-core watcher was unaffected — it uses `gh` at a valid path.)

**Fix:** resolve npm via `command -v` then known install locations; `exit 0` only if npm is truly absent (never wedge cron). Verified: resolves `/opt/homebrew/bin/npm` under a minimal PATH. Propagated the fixed script to the checkout cron actually runs (`/Users/jnuyens/claude-code-gsd/`). Version file left at 0.14.4 so the next `:23` cron run emails the 0.14.4->0.14.8 catch-up once, then advances.

**Deeper issue (not fixed here):** cron runs all three watchers from a SEPARATE stale checkout (`/Users/jnuyens/claude-code-gsd/`), not this repo. Edits here don't reach cron unless copied over. Recommend reconciling: repoint cron at `src/gsd-plugin`, or retire the old checkout. Also note both watchers share a latent fragility — the version file only advances after a successful SSH mail send (set -e), so a mail failure wedges them; the npm fix removes the current cause but the mail-wedge remains.
