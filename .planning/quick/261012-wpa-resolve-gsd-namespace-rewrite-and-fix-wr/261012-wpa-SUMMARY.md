---
quick_id: 261012-wpa
slug: resolve-gsd-namespace-rewrite-and-fix-wr
date: 2026-10-12
status: complete
commits:
  - 2d06db6 refactor: namespace sweep (/gsd- -> /gsd:)
  - 89d3439 docs: rescue stash-stranded work
  - 170ed97 fix: WR-01 SDK fail-closed
  - 03a58f2 build: regenerate dist/bm
---

# Quick Task 261012-wpa Summary

Two pieces of housekeeping, done on the main tree (no worktree: the git work
needed human-in-the-loop reasoning and `.planning/` is tracked-but-gitignored,
which makes worktree isolation unsafe here).

## Task 1: namespace sweep + stash disposition

- **Committed the sweep** (`2d06db6`): 51 tracked files rewriting the legacy
  `/gsd-<verb>` command form to `/gsd:<verb>` across hooks, references,
  templates, workflows, the SDK (src + rebuilt dist), and four archived
  quick-task docs. The operator scratch file `gsd-bugs-housekeeping.rtf` was
  left untracked.
- **Rescued stash-stranded work** (`89d3439`) BEFORE dropping. `stash@{0}` was
  not a pure duplicate of the sweep: it carried unique, uncommitted content that
  existed nowhere in HEAD:
  - the "260902 update" ledger in `vibedrift-scan-260822.md` (the real record
    of quick task 260902-0o5, whose commit `a7788cb` is an empty 0-byte stub),
  - stray closing-tag (`</content>`/`</invoke>`) cleanups in seven archived
    docs (phase 13-03/13-04/13-VALIDATION, 15-01/15-02/15-RESEARCH, and quick
    260515-f2d-PLAN),
  - the STATE.md operator-next-steps namespace line.
  Six-plus-one files were base-unchanged since the stash base (`d2e6031`) and
  restored wholesale; STATE.md had moved since then, so only its one line was
  applied by hand (restoring its stash copy would have reverted the phase-18
  completion update).
- **Dropped `stash@{0}`** after verifying every remaining difference was stale,
  superseded phase-18 status (HEAD is newer and more complete; its
  `deferred-items.md` even describes this stash as "a redundant duplicate
  snapshot" awaiting disposition). The dropped stash is `acc7ba2` and is
  recoverable from the reflog for ~90 days (`git stash apply acc7ba2`).

## Task 2: code-review WR-01 (SDK `--validate-external` fail-closed)

- **Fixed** (`170ed97`) `sdk/src/query/craft-skill.ts`: the assess handler
  funneled `--validate-external` through `asString()`, which collapses a bare
  flag (boolean `true`, no directory) to `undefined`. That hit the "validation
  not requested" early return, so the SDK returned the base verdict without
  running the linter: an opt-in security check failing open, while the CJS twin
  failed loud. The handler now detects the boolean-true case and raises the same
  usage `GSDError` the CJS twin raises, restoring twin parity.
- **Test:** added a parity case to `tests/craft-skill-sdk-parity.test.cjs`
  asserting a bare `--validate-external` fails loud in both twins and spawns no
  npx. All craft-skill parity checks pass. Verified directly: the built SDK CLI
  now exits 1 with "--validate-external requires an existing skill directory".

## Task 3: dist/bm regeneration

- **Regenerated** (`03a58f2`) `dist/bm` (52 files) so the generated bm plugin
  mirrors the committed gsd source. `npm run check:bm-drift` PASSES on a clean
  tree.

## Verification
- `git stash list`: empty.
- `node tests/craft-skill-sdk-parity.test.cjs`: all checks pass (incl. new case).
- Built SDK bare `--validate-external`: exit 1, correct usage error.
- `npm run check:bm-drift`: PASS (committed dist/bm matches a fresh build).
- No command-form `/gsd-<verb>` references remain in live command surfaces
  (remaining `/gsd-` hits are filenames like `bin/gsd-resume-at` and CHANGELOG
  history).
- SDK unit suite: see below.
