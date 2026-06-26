---
phase: 10
slug: convention-and-architectural-conformance
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-26
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| caller -> deriveConventions/checkConformance | File-path list (from `--files` or a corpus scan) and raw source text cross into the module | Untrusted paths + arbitrary source bytes |
| subagent Bash -> `verify conventions` subcommand | `--files` CSV and `--scope` dir cross from agent-controlled args into the CLI | Untrusted path args |
| review workflow -> reviewer subagent -> `verify conventions --check` | The changed-`files` list crosses from the workflow into the subcommand | Untrusted changed-file paths |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-10-01 | Tampering | path inputs to deriveConventions/checkConformance | mitigate | `SAFE_PATH_RE` + `sanitizePaths` (conventions.cjs:52,86-96) reject absolute/`..` paths before any fs read | closed |
| T-10-02 | Denial of Service | identifier/idiom regexes on adversarial source | mitigate | Linear `blankSpans` pre-pass (no nested quantifiers); `MAX_SCAN_BYTES=512KB` cap (conventions.cjs:328); linear extraction regexes | closed |
| T-10-03 | Denial of Service | malformed/binary file fed as source | mitigate | Never-throw: per-file try/catch skip, non-text/oversize skipped, returns `{skipped:true,reason}` | closed |
| T-10-04 | Tampering | `--files` / `--scope` args to cmdVerifyConventions | mitigate | Handler runs `--scope` + `--files` CSV through `sanitizePaths` (verify.cjs:1426,1451) before read; module re-sanitizes (defense in depth) | closed |
| T-10-05 | Denial of Service | subcommand failing the review/plan gate | mitigate | Never-exit-nonzero: every branch emits `{skipped:true,reason}` JSON and returns 0 (verify.cjs:1501-1504) | closed |
| T-10-06 | Tampering | drift between TS manifest and hand-synced `command-aliases.generated.cjs` | mitigate | `verify.conventions` in BOTH the TS manifest (command-manifest.verify.ts:15) and the CJS alias map (command-aliases.generated.cjs:242-249); in sync | closed |
| T-10-07 | Elevation of Privilege | a CONVENTION finding escalating to a blocking gate | mitigate | Reviewer markdown pins CONVENTION below WARNING, never blocks/gates (gsd-code-reviewer.md:31,93); module hardcodes `blocking:false` (conventions.cjs:469) | closed |
| T-10-08 | Tampering | changed-file paths spliced into the subcommand from the workflow | mitigate | `--files` CSV sanitized in handler + module (SAFE_PATH_RE); reviewer markdown only forwards the existing changed-files list, no path construction | closed |
| T-10-09 | Repudiation | contested axes silently dropped (losing the Phase 11 head start) | accept | Contested axes reported as PATTERNS.md hotspots (pattern-mapper.md:157), never suppressed; documentation-only, low risk | closed |
| T-10-SC | Tampering | npm/pip/cargo installs (supply chain) | mitigate | Zero external deps: `conventions.cjs` requires only `node:fs`/`node:path`; CI `conventions` job runs without `npm ci` (check-drift.yml) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-09 | Contested axes are reported as "author's choice" hotspots in the PATTERNS.md Conventions section rather than emitting a finding — this is by design (D-01/D-02), gives Phase 11 a head start, and is documentation-only. The auditor confirmed they are preserved (`status:'contested'` + `share`/`variants`), not silently dropped. | gsd-security-auditor (verified) | 2026-06-26 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-26 | 10 | 10 | 0 | gsd-security-auditor (verify-mitigations mode) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-26
