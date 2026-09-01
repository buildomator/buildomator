---
created: 2026-09-01T22:24:31.304Z
title: DRIFT-precision heuristic port from VibeDrift v0.20.0
area: tooling
files:
  - bin/lib/conventions.cjs
  - bin/lib/semantic-dup.cjs
  - .planning/notes/vibedrift-scan-260822.md
  - bin/check-vibedrift-release.sh
---

## Problem

The v0.20.0 scan of the VibeDrift second upstream (`.planning/notes/vibedrift-scan-260822.md`, read it first) found real precision heuristics landed since our native-port idea baseline of v0.14.0. We ship none of VibeDrift at runtime; we port the heuristics natively. Three candidates, none ported yet. Our watcher was repointed to the live `VibeDrift/VibeDrift` in v4.5.6, but the idea baseline pin is still v0.14.0.

Run this later as `/bm:quick --validate`. Related but distinct from [[2026-06-27-drift-detector-followups-from-code-review]] (that todo is internal Phase 11 review deferrals); note its item 4 (dead `METHOD_RE` in `semantic-dup.cjs extractFunctions`) touches the SAME extractor as candidate 2 below, so look at both together when either runs.

1. **CONFIRMED GAP - exclude test/seed/script files from the convention vote.** `bin/lib/conventions.cjs` (and its SDK twin if one exists) has no test/seed/script file exclusion, so test files skew the derived convention vote and then get flagged against app conventions. Add a path-shape exclusion (test/spec/seed/script/fixture) before a file participates in the convention tally. Mirror VibeDrift's exclusion set.

2. **NEEDS CONFIRMATION FIRST - drop callback-wrapper phantoms from the semantic-dup index.** `bin/lib/semantic-dup.cjs` already excludes constructors (`:282` "not constructors for simplicity") and anon/IIFE (`:265`). Before treating this as a real gap, verify against the function-declaration extractor whether `test("x", function(a){...})`-style callback wrappers actually get indexed as duplicate candidates. Only port the exclusion if the phantom is real; otherwise record it as already-covered.

3. **MODERATE/LARGER - import-habit drift axis (new in VibeDrift v0.18.0).** A new drift axis we do not have. Scope the algorithm from the VibeDrift release notes and decide whether it earns a native port or is deferred.

## Solution

TBD per candidate. Both resolver twins stay in lock-step where golden/parity-covered; rebuild sdk/dist; add regression tests; regenerate dist/bm and require `node bin/build-bm.cjs --check` PASS; NO GSD bookkeeping or upstream PR numbers in product source or comments; no version bump (release cut separately). After porting whatever lands, advance the native-port idea baseline pin (currently v0.14.0) toward v0.20.0 in the tracking note. Context: [[reference_upstream_sync_state]]; DRIFT-* modules from the v4.0.0 consistency-safeguards milestone [[project_v13_consistency_safeguards]].
