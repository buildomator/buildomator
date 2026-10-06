# Deferred items: Phase 17

## From plan 17-02

- **dist/bm regeneration + build-bm --check.** `node bin/build-bm.cjs --check` reports FAIL.
  My 17-02 source edits (`agents/bm-executor.md` changed, `references/craft-skill-propose-on-fit.md`
  new) are not yet mirrored into the committed `dist/bm`. The gate was already failing before 17-02
  from plan 01's not-yet-mirrored work (`sdk/dist/*`, `bin/lib/craft-skill-insert.cjs`, `sdk/src/*`,
  `tests/craft-skill-sdk-parity.test.cjs`). Plan 17-02 deliberately scoped to source files only
  (no `dist/bm` in `files_modified`, no `--check` in verification), matching the Phase 16 pattern
  where a later consolidation plan stages `sdk/dist` and regenerates `dist/bm` in one pass. Out of
  scope here; a later plan in this phase must run the regeneration so the drift gate returns to PASS.
