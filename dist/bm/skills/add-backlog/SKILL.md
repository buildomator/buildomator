---
name: gsd:add-backlog
description: Add an idea to the backlog parking lot (999.x numbering)
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Add a backlog item to the roadmap using 999.x numbering. Backlog items are unsequenced ideas outside the normal phase sequence.
</objective>

<process>

1. **Read ROADMAP.md** to find existing backlog entries:
   ```bash
   cat .planning/ROADMAP.md
   ```

2. **Find next backlog number:**
   ```bash
   NEXT=$(gsd-sdk query phase.next-decimal 999 --raw)
   ```
   If no 999.x phases exist, start at 999.1.

3. **Add to ROADMAP.md** under a `## Backlog` section. If the section doesn't exist, create it at the end.
   Write the ROADMAP entry BEFORE creating the directory, so directory existence reliably means the phase is already registered (prevents false duplicate detection in hooks checking 999.x directories, #2280):

   ```markdown
   ## Backlog

   ### Phase {NEXT}: {description} (BACKLOG)

   **Goal:** [Captured for future planning]
   **Requirements:** TBD
   **Plans:** 0 plans

   Plans:
   - [ ] TBD (promote with /bm:review-backlog when ready)
   ```

4. **Create the phase directory:**
   ```bash
   SLUG=$(gsd-sdk query generate-slug "$ARGUMENTS" --raw)
   mkdir -p ".planning/phases/${NEXT}-${SLUG}"
   touch ".planning/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

5. **Commit:**
   ```bash
   gsd-sdk query commit "docs: add backlog item ${NEXT} — ${ARGUMENTS}" .planning/ROADMAP.md ".planning/phases/${NEXT}-${SLUG}/.gitkeep"
   ```

6. **Report:**
   ```
   ## 📋 Backlog Item Added

   Phase {NEXT}: {description}
   Directory: .planning/phases/{NEXT}-{slug}/

   This item lives in the backlog parking lot.
   Use /bm:discuss-phase {NEXT} to explore it further.
   Use /bm:review-backlog to promote items to active milestone.
   ```

</process>

<notes>
- 999.x numbering keeps backlog items out of the active phase sequence
- Phase directories are created immediately, so /bm:discuss-phase and /bm:plan-phase work on them
- No `Depends on:` field — backlog items are unsequenced by definition
- Sparse numbering is fine (999.1, 999.3) — always uses next-decimal
</notes>
