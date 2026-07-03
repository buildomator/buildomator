<purpose>
Surface Claude's assumptions about a phase before planning, so users can correct misconceptions early.

Difference from discuss-phase: this is ANALYSIS of what Claude thinks, not INTAKE of what the user knows. No file output - purely conversational.
</purpose>

<process>

<step name="validate_phase" priority="first">
Phase number: $ARGUMENTS (required)

**If argument missing:**

```
Error: Phase number required.

Usage: /gsd:list-phase-assumptions [phase-number]
Example: /gsd:list-phase-assumptions 3
```

Exit workflow.

**If argument provided:**
Validate phase exists in roadmap:

```bash
cat .planning/ROADMAP.md | grep -i "Phase ${PHASE}"
```

**If phase not found:**

```
Error: Phase ${PHASE} not found in roadmap.

Available phases:
[list phases from roadmap]
```

Exit workflow.

**If phase found:**
Parse phase details from roadmap:

- Phase number
- Phase name
- Phase description/goal
- Any scope details mentioned

Continue to analyze_phase.
</step>

<step name="analyze_phase">
Based on roadmap description and project context, identify assumptions across five areas:

**1. Technical Approach:** What libraries, frameworks, patterns, or tools would Claude use, and why?

**2. Implementation Order:** What would Claude build first, second, third, and why?

**3. Scope Boundaries:** What's included vs excluded vs ambiguous in Claude's interpretation?

**4. Risk Areas:** Where does Claude expect complexity or challenges?

**5. Dependencies:** What does Claude assume exists from prior phases, external deps, and what consumes this?

Be honest about uncertainty. Mark assumptions with confidence levels:
- "Fairly confident: ..." (clear from roadmap)
- "Assuming: ..." (reasonable inference)
- "Unclear: ..." (could go multiple ways)
</step>

<step name="present_assumptions">
Present assumptions in this format:

```
## My Assumptions for Phase ${PHASE}: ${PHASE_NAME}

### Technical Approach
[List assumptions about how to implement]

### Implementation Order
[List assumptions about sequencing]

### Scope Boundaries
**In scope:** [what's included]
**Out of scope:** [what's excluded]
**Ambiguous:** [what could go either way]

### Risk Areas
[List anticipated challenges]

### Dependencies
**From prior phases:** [what's needed]
**External:** [third-party needs]
**Feeds into:** [what future phases need from this]

---

**What do you think?**

Are these assumptions accurate? Let me know:
- What I got right
- What I got wrong
- What I'm missing
```

Wait for user response.
</step>

<step name="gather_feedback">
**If user provides corrections:**

Acknowledge the corrections:

```
Key corrections:
- [correction 1]
- [correction 2]

This changes my understanding significantly. [Summarize new understanding]
```

**If user confirms assumptions:**

```
Assumptions validated.
```

Continue to offer_next.
</step>

<step name="offer_next">
Present next steps:

```
What's next?
1. Discuss context (/gsd:discuss-phase ${PHASE}) - Let me ask you questions to build comprehensive context
2. Plan this phase (/gsd:plan-phase ${PHASE}) - Create detailed execution plans
3. Re-examine assumptions - I'll analyze again with your corrections
4. Done for now
```

Wait for user selection.

If "Discuss context": Note that CONTEXT.md will incorporate any corrections discussed here
If "Plan this phase": Proceed knowing assumptions are understood
If "Re-examine": Return to analyze_phase with updated understanding
</step>

</process>

<success_criteria>
- Phase number validated against roadmap
- Assumptions surfaced across five areas: technical approach, implementation order, scope, risks, dependencies
- Confidence levels marked where appropriate
- "What do you think?" prompt presented
- User feedback acknowledged
- Clear next steps offered
</success_criteria>
