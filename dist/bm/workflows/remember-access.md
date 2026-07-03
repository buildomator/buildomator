<purpose>
Capture or review authentication / access recipes for the current project. Two modes:

1. **Manual capture:** `/gsd:remember-access <system-name>` documents how to authenticate to a named system (e.g., github, aws, npm, ssh).
2. **Inbox review:** `/gsd:remember-access --review` surfaces detections captured by the `gsd-auth-detector` PostToolUse hook for confirm/discard.

Confirmed recipes go to `.planning/AUTH-RECIPES.md` (per-project) and optionally `~/.claude/auth-recipes/<system>.md` (cross-project memory).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context.
</required_reading>

<process>

## 1. Parse arguments

Parse `$ARGUMENTS`:

- If `--review` present: mode = `review`.
- Otherwise: mode = `manual`, system-name = first non-flag positional argument. If no system-name provided in manual mode, ask the user via AskUserQuestion to name the system (suggested options: github, aws, gcloud, npm, ssh, docker, kubernetes, vault, 1password, or Other for freeform).

## 2. Ensure .planning/ exists

If `.planning/` does not exist, error: `Auth recipes require a GSD project. Run /gsd:new-project or /gsd:new-ddd first.` Exit.

## 3. Manual capture mode

For `mode == manual`:

### 3a. Gather recipe details

Use AskUserQuestion to confirm the system identity:

```
AskUserQuestion(
  header: "System",
  question: "What's the canonical name for this system?",
  options: [
    { label: "${system_name_argument}", description: "Use the name passed on the command line" },
    { label: "Other", description: "Type a different name" }
  ]
)
```

Then ask freeform (text input) prompts to gather:

- **What auth method?** (e.g., OAuth flow via `gh auth login`, API key in env var, SSH key, certificate)
- **What command(s) did you run to set it up?** Capture exact commands (the user types or pastes). The recipe stores these so future-you can replay them.
- **What environment variables, config files, or credential locations does this system use?** (e.g., `~/.aws/credentials`, `GH_TOKEN` env var, `~/.ssh/id_ed25519`)
- **How do you verify auth is working?** (e.g., `gh auth status`, `aws sts get-caller-identity`)
- **Anything else worth remembering?** Freeform notes (token expiry, MFA flow, multi-account quirks, etc.)

### 3b. Write per-project recipe

Append to (or create) `.planning/AUTH-RECIPES.md`:

```markdown
# Auth Recipes

How this project authenticates to external systems. Replay these recipes when setting up a fresh dev environment or after credential rotation.

## {system-name}

**Auth method:** {brief description}

**Setup commands:**

```bash
{exact commands the user ran}
```

**Credentials location:**
- {file path or env var}
- {file path or env var}

**Verification:**

```bash
{verification command}
```

**Notes:** {freeform notes}

**Captured:** {ISO timestamp}
```

If the file already exists, find any prior `## {system-name}` section. If present, ask the user via AskUserQuestion whether to:
- Update (replace the old section with the new)
- Append (add as `## {system-name} (re-captured YYYY-MM-DD)`)
- Cancel (do not write)

### 3c. Optionally promote to cross-project memory

Use AskUserQuestion:

```
AskUserQuestion(
  header: "Cross-project",
  question: "Save this recipe for future projects too?",
  options: [
    { label: "Yes (Recommended)", description: "Also write to ~/.claude/auth-recipes/${system}.md so future projects starting fresh can read it" },
    { label: "No", description: "Keep this recipe project-local only" }
  ]
)
```

If yes:

```bash
GLOBAL_DIR="${HOME}/.claude/auth-recipes"
mkdir -p "$GLOBAL_DIR"
```

Write the same recipe content to `${GLOBAL_DIR}/${system}.md` (overwriting any prior recipe for the same system; the user just confirmed it).

### 3d. Log to AUTO-DECISIONS.md

Append a row to `.planning/AUTO-DECISIONS.md`:

```bash
TS=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
echo "| ${TS} | /gsd:remember-access | Captured auth recipe for ${system} | .planning/AUTH-RECIPES.md |" >> .planning/AUTO-DECISIONS.md
```

(Create the file with the header if missing; same pattern as the `workflow.auto_approve_non_critical` flow in `new-project.md` and `new-ddd.md`.)

### 3e. Commit

```bash
FILES=".planning/AUTH-RECIPES.md .planning/AUTO-DECISIONS.md"
git add ${FILES} 2>/dev/null
git commit -m "docs(auth): capture ${system} access recipe" -- ${FILES} || true
```

The user-global file at `~/.claude/auth-recipes/` is NOT committed (it's outside the repo).

### 3f. Confirm

```
✓ Recipe captured for ${system}
  Per-project: .planning/AUTH-RECIPES.md
  Cross-project: ${HOME}/.claude/auth-recipes/${system}.md (if promoted)
```

## 4. Review mode

For `mode == review`:

### 4a. Read the inbox

```bash
INBOX=".planning/.pending-auth-captures.jsonl"
[ -f "$INBOX" ] || { echo "No pending captures."; exit 0; }
wc -l < "$INBOX"
```

If empty, exit with `No pending captures. Run /gsd:remember-access <system> to capture manually.`

### 4b. Display each entry

For each line in `$INBOX`, parse the JSON and display:

```
Pending capture {N} of {M}:
  Detected at: {timestamp}
  Command: {command_redacted}
  Matched systems: {matches[].system}, kinds: {matches[].kind}
  Exit code: {exit_code}
  CWD: {cwd}
```

### 4c. Decide per entry

For each entry, use AskUserQuestion:

```
AskUserQuestion(
  header: "Capture ${N}/${M}",
  question: "Save this as an auth recipe?",
  options: [
    { label: "Save as recipe", description: "Promote to .planning/AUTH-RECIPES.md (and optionally ~/.claude/auth-recipes/)" },
    { label: "Skip", description: "Discard this capture, no recipe saved" },
    { label: "Discard all remaining", description: "Stop reviewing, clear the inbox" }
  ]
)
```

If `Save as recipe`: fall through to the manual-capture flow at step 3 with the detected command(s) pre-filled as the "what commands did you run" answer. User confirms or edits, then writes the recipe.

If `Skip`: continue to next entry without writing.

If `Discard all remaining`: empty the inbox (`> "$INBOX"`) and exit.

### 4d. Empty the inbox after review

Once all entries are reviewed (or user discarded all), empty the inbox:

```bash
> "$INBOX"
```

The hook will repopulate as new auth-shaped commands are detected.

### 4e. Commit any new recipes

If recipes were saved during the review, the manual-capture flow already committed them. Confirm to user:

```
✓ Reviewed ${M} pending captures
  Saved: ${SAVED} recipe(s)
  Skipped: ${SKIPPED}
  Inbox cleared.
```

## 5. Help if no arguments

If `$ARGUMENTS` is empty AND no inbox file exists AND no recipes file exists yet, display usage:

```
/gsd:remember-access: capture auth recipes for external systems

Usage:
  /gsd:remember-access github          Capture how to authenticate to GitHub
  /gsd:remember-access aws             Capture how to authenticate to AWS
  /gsd:remember-access --review        Review auto-detected captures
  /gsd:remember-access                 (no args, no inbox, no recipes yet) show this help

Auto-detection runs continuously via the gsd-auth-detector PostToolUse hook.
Run /gsd:remember-access --review to surface pending captures.

Recipes live at:
  .planning/AUTH-RECIPES.md           (per-project)
  ~/.claude/auth-recipes/<system>.md  (cross-project, optional)
```

</process>

<success_criteria>
- [ ] Argument parsed (--review or system-name)
- [ ] `.planning/` existence checked
- [ ] Manual mode: recipe captured with auth method, setup commands, credentials location, verification, notes
- [ ] Manual mode: per-project recipe written to `.planning/AUTH-RECIPES.md`
- [ ] Manual mode: cross-project recipe written to `~/.claude/auth-recipes/<system>.md` if user opted in
- [ ] Review mode: inbox parsed, each entry surfaced, user decision per entry
- [ ] Review mode: confirmed entries promoted via the manual-capture flow
- [ ] Review mode: inbox cleared after review
- [ ] AUTO-DECISIONS.md row appended for each saved recipe
- [ ] Per-project artifacts committed; cross-project file not committed
</success_criteria>
