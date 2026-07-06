<purpose>
Create all phases necessary to close gaps identified by `/bm:audit-milestone`. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase. One command creates all fix phases, no manual `/bm:add-phase` per gap.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Load Audit Results

```bash
(ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null || true) | head -1
```

Parse YAML frontmatter to extract structured gaps:
- `gaps.requirements` — unsatisfied requirements
- `gaps.integration` — missing cross-phase connections
- `gaps.flows` — broken E2E flows

If no audit file exists or has no gaps, error:
```
No audit gaps found. Run `/bm:audit-milestone` first.
```

## 2. Prioritize Gaps

Group gaps by priority from REQUIREMENTS.md:

| Priority | Action |
|----------|--------|
| `must` | Create phase, blocks milestone |
| `should` | Create phase, recommended |
| `nice` | Ask user: include or defer? |

For integration/flow gaps, infer priority from affected requirements.

## 3. Group Gaps into Phases

Cluster related gaps into logical phases:

**Grouping rules:**
- Same affected phase → combine into one fix phase
- Same subsystem (auth, API, UI) → combine
- Dependency order (fix stubs before wiring)
- Keep phases focused: 2-4 tasks each

**Example grouping:**
```
Gap: DASH-01 unsatisfied (Dashboard doesn't fetch)
Gap: Integration Phase 1→3 (Auth not passed to API calls)
Gap: Flow "View dashboard" broken at data fetch

→ Phase 6: "Wire Dashboard to API"
  - Add fetch to Dashboard.tsx
  - Include auth header in fetch
  - Handle response, update state
  - Render user data
```

## 4. Determine Phase Numbers

Find highest existing phase:
```bash
HIGHEST=$(gsd-sdk query phases.list --pick directories[-1])
```

New phases continue from there:
- If Phase 5 is highest, gaps become Phase 6, 7, 8...

## 5. Present Gap Closure Plan

```markdown
## Gap Closure Plan

**Milestone:** {version}
**Gaps to close:** {N} requirements, {M} integration, {K} flows

### Proposed Phases

**Phase {N}: {Name}**
Closes:
- {REQ-ID}: {description}
- Integration: {from} → {to}
Tasks: {count}

**Phase {N+1}: {Name}**
Closes:
- {REQ-ID}: {description}
- Flow: {flow name}
Tasks: {count}

{If nice-to-have gaps exist:}

### Deferred (nice-to-have)

These gaps are optional. Include them?
- {gap description}
- {gap description}

---

Create these {X} phases? (yes / adjust / defer all optional)
```

Wait for user confirmation.

## 6. Update ROADMAP.md

Add new phases to current milestone:

```markdown
### Phase {N}: {Name}
**Goal:** {derived from gaps being closed}
**Requirements:** {REQ-IDs being satisfied}
**Gap Closure:** Closes gaps from audit

### Phase {N+1}: {Name}
...
```

## 7. Update REQUIREMENTS.md Traceability Table (REQUIRED)

For each REQ-ID assigned to a gap closure phase:
- Update the Phase column to reflect the new gap closure phase
- Reset Status to `Pending`

Reset checked-off requirements the audit found unsatisfied:
- Change `[x]` → `[ ]` for any requirement marked unsatisfied in the audit
- Update coverage count at top of REQUIREMENTS.md

```bash
grep -c "Pending" .planning/REQUIREMENTS.md
```

## 8. Create Phase Directories

For each new phase (N, N+1, …), resolve the directory name via `init.phase-op` so the `project_code` prefix is honoured:

```bash
INIT=$(gsd-sdk query init.phase-op "{NN}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
expected_phase_dir=$(echo "$INIT" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).expected_phase_dir)")
mkdir -p "${expected_phase_dir}"
```

Repeat for each gap-closure phase number. This produces `{CODE}-{NN}-{slug}/` when `project_code` is set in `.planning/config.json`, and `{NN}-{slug}/` otherwise — consistent with all other phase-creation paths.

## 9. Commit Roadmap and Requirements Update

```bash
gsd-sdk query commit "docs(roadmap): add gap closure phases {N}-{M}" --files .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## 10. Offer Next Steps

```markdown
## ✓ Gap Closure Phases Created

**Phases added:** {N} - {M}
**Gaps addressed:** {count} requirements, {count} integration, {count} flows

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Plan first gap closure phase**

`/clear` then:

`/bm:plan-phase {N}`

---

**Also available:**
- `/bm:execute-phase {N}`, if plans already exist
- `cat .planning/ROADMAP.md` — see updated roadmap

---

**After all gap phases complete:**

`/bm:audit-milestone`, re-audit to verify gaps closed
`/bm:complete-milestone {version}`, archive when audit passes
```

</process>

<gap_to_phase_mapping>

## How Gaps Become Tasks

Each gap's `missing` items become one task each in the new phase.

**Requirement gap → Tasks:**
```yaml
gap: {id: DASH-01, missing: ["useEffect fetch /api/user/data", "user data state", "render data in JSX"]}
becomes phase "Wire Dashboard Data" with one task per missing item, files scoped to the affected component.
```

**Integration gap → Tasks:**
```yaml
gap: {from_phase: 1, to_phase: 3, missing: ["Auth header in fetch calls", "Token refresh on 401"]}
becomes phase "Add Auth to Dashboard API Calls" with one task per missing item.
```

**Flow gap → Tasks:** Usually the same phase as the overlapping requirement/integration gap; flow gaps often overlap with other gap types.

</gap_to_phase_mapping>

<success_criteria>
- [ ] MILESTONE-AUDIT.md loaded and gaps parsed
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into logical phases
- [ ] User confirmed phase plan
- [ ] ROADMAP.md updated with new phases
- [ ] REQUIREMENTS.md traceability table updated with gap closure phase assignments
- [ ] Unsatisfied requirement checkboxes reset (`[x]` → `[ ]`)
- [ ] Coverage count updated in REQUIREMENTS.md
- [ ] Phase directories created
- [ ] Changes committed (includes REQUIREMENTS.md)
- [ ] User knows to run `/bm:plan-phase` next
</success_criteria>
