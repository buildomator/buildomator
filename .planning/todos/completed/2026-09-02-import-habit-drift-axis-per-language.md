---
created: 2026-09-02T00:00:00.000Z
title: Import-habit drift axis (per-language grouping/ordering/relative/wildcard)
area: tooling
files:
  - bin/lib/conventions.cjs
---

## Problem

Our `import-style` axis in `bin/lib/conventions.cjs` only detects module system
(require vs import) and only for JS/TS. VibeDrift (v0.18.0) treats import habits
as a richer, independently-voted axis that learns each language's conventions
from the repo's own code and flags files that break them.

Deferred from quick task 260902-0o5 (candidate 3 of the VibeDrift v0.20.0 scan).
A quick task can safely land the test-file exclusion and the semantic-dup phantom
fix, but a per-language import-habit axis is a phase-sized build, not a quick add.

## Scoped algorithm (from VibeDrift v0.18.0 release notes)

Import-style drift becomes a set of independently-voted, directory-scoped
sub-signals per language. Each dimension is derived from the repo's own files
(majority vote with the existing entropy + dominance/min-sample gate) and each
file is judged per dimension, so a file can be consistent on one axis and drift
on another.

Per-language dimensions:

- Go: import grouping (stdlib / third-party / local blocks) and gofmt ordering.
- Python: absolute-vs-relative import paths, and wildcard (`from x import *`) use.
- Rust: glob imports, intra-crate path style (`crate::` vs `super::`/`self::`),
  and use-grouping.
- JS/TS: unchanged module-system signal (already ported), now reading CommonJS
  `require()` alongside ES imports.

Precision guards to carry over:
- Scope each vote to its directory (already available via `deriveConventions`
  `opts.scope`).
- Leave idiomatic-but-inconsistent-looking patterns alone (VibeDrift's example:
  a glob import inside a Rust test module). The non-app-file exclusion landed in
  260902-0o5 already covers the test-module case for our port.
- Do not draw a score/trend across the coverage change (we compute no composite
  score, so this is a non-issue for us).

## Why defer

A new voted axis with per-language habit detection (Go/Python/Rust parsers or
regex packs for grouping, ordering, relative paths, wildcards) is genuinely new
work versus the current single module-system signal. It needs its own rule packs,
per-dimension vote wiring, and a language dispatch, which is a DRIFT-precision
phase, not a quick-task add. Sequence it alongside the existing pending item to
add more language rule packs for the naming-drift checks
(2026-06-26-add-more-programming-language-rule-packs-...).
