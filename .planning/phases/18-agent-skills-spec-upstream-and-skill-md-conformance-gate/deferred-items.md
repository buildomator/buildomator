# Phase 18 Deferred Items (out of scope for the executing plans)

- `node bin/maintenance/check-drift.cjs` exits 1 on this workstation for two pre-existing reasons unrelated to plan 18-03:
  1. HANDOFF schema validator exits 2 because `ajv`/`ajv-formats` dev dependencies are not installed here (`npm install --include=dev` was never run in this checkout).
  2. Namespace drift reports 198 dash-style command refs, all in committed `sdk/dist/cli.js`, `sdk/dist/query/validate.js` and `sdk/src/query/validate.ts` (not files this plan touches).
  Both predate plan 18-03. The SKILL.md conformance detector added by this plan passes inside the umbrella; the umbrella's overall non-zero exit is caused only by the two pre-existing detectors above. Not fixed here.
