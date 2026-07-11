/**
 * Checkpoint — Shared HANDOFF.json generation for manual pause and auto-compact
 *
 * Single source of truth for the HANDOFF.json schema (D-10, D-12). Both the
 * PreCompact hook and the /bm:pause-work skill call into this library so the
 * two code paths stay in sync.
 *
 * Schema matches skills/pause-work/SKILL.md (lines 89-121) plus the
 * `source` and `partial` extensions required by Phase 4 (D-01, D-04, D-11).
 *
 * Design constraints:
 *   - Must NEVER throw. The PreCompact hook has a 5s timeout budget and a
 *     crash there would block context compaction (D-04).
 *   - Writes to disk only; no git commits (D-06).
 *   - Overwrites any existing HANDOFF.json — latest snapshot wins (D-05).
 */

const fs = require('fs');
const path = require('path');

const {
  planningPaths,
  execGit,
  findPhaseInternal,
  output,
} = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { acquireStateLock, releaseStateLock } = require('./state.cjs');
const { platformReadSync: safeReadFile, platformWriteSync } = require('./shell-command-projection.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a simple field from the STATE.md body.
 * Supports lines like `Phase: 4 - Checkpoint and Resume` or `**Plan:** 01`.
 * Returns the trimmed value or null.
 */
function extractBodyField(body, fieldName) {
  if (!body) return null;
  // Escape regex special chars in fieldName (keep it simple — only word chars expected)
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boldRe = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, 'i');
  const boldMatch = body.match(boldRe);
  if (boldMatch) return boldMatch[1].trim();
  const plainRe = new RegExp(`^${escaped}:\\s*(.+)$`, 'im');
  const plainMatch = body.match(plainRe);
  return plainMatch ? plainMatch[1].trim() : null;
}

/**
 * Parse "Phase: 4 - Checkpoint and Resume" into { number: "4", name: "Checkpoint and Resume" }
 * Also accepts plain "4" or "04-checkpoint-and-resume".
 */
function parsePhaseLine(value) {
  if (!value) return { number: null, name: null };
  const str = String(value).trim();
  // "4 - Checkpoint and Resume" or "04 - Checkpoint and Resume"
  const dashMatch = str.match(/^(\d+)\s*[-—]\s*(.+)$/);
  if (dashMatch) return { number: dashMatch[1], name: dashMatch[2].trim() };
  // "04-checkpoint-and-resume"
  const slugMatch = str.match(/^(\d+)-(.+)$/);
  if (slugMatch) {
    const name = slugMatch[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { number: slugMatch[1], name };
  }
  // Just a number
  const numMatch = str.match(/^(\d+)$/);
  if (numMatch) return { number: numMatch[1], name: null };
  return { number: null, name: str };
}

/**
 * Extract the named section body from STATE.md markdown.
 * Returns the text between `### Section` (or `## Section`) and the next heading,
 * or '' if not found.
 */
function extractSection(body, sectionName) {
  if (!body) return '';
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match ## or ### headings
  const re = new RegExp(`#{2,3}\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n#{2,3}\\s|$)`, 'i');
  const match = body.match(re);
  return match ? match[1].trim() : '';
}

/**
 * Pull bullet-list items out of a markdown block. Filters placeholders.
 * Returns an array of strings, possibly empty.
 */
function extractBullets(sectionText) {
  if (!sectionText) return [];
  const lines = sectionText.split(/\r?\n/);
  const bullets = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)$/);
    if (!m) continue;
    const text = m[1].trim();
    // Skip placeholder entries like "None.", "None", italicized stubs.
    if (/^none\.?$/i.test(text)) continue;
    if (/^_none_$/i.test(text)) continue;
    bullets.push(text);
  }
  return bullets;
}

/**
 * Parse `git status --porcelain` output into an array of file entries.
 * Each entry is an object: { status: "M", path: "file.txt" }
 *
 * Porcelain v1 format per line is: "XY␣path" where X is the index status, Y
 * is the worktree status, then a single space, then the path. Either X or Y
 * may be a literal space (unmodified-in-that-column), e.g. " M foo" means
 * modified-in-worktree-only.
 *
 * Note: execGit() in core.cjs calls .trim() on the stdout string, which
 * strips the leading space from the FIRST line only. We handle that by
 * using a forgiving regex rather than fixed-column slicing.
 */
function parsePorcelain(stdout) {
  if (!stdout) return [];
  return stdout
    .split(/\r?\n/)
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.length > 0)
    .map(line => {
      // Handle both " M path" and "M  path" (leading-space-trimmed first line).
      // Regex: optional leading space, 1-2 non-space status chars, 1+ spaces, path.
      const match = line.match(/^\s?(\S{1,2})\s+(.+)$/);
      if (!match) return { status: '??', path: line };
      return { status: match[1], path: match[2] };
    });
}

/**
 * Scan a phase directory for PLAN/SUMMARY pairs and classify plans as
 * completed or remaining. Returns { completed: [...], remaining: [...] }.
 * Each entry is { id, name, status, commit? } matching the HANDOFF.json format.
 */
function scanPhasePlans(phaseDir) {
  const result = { completed: [], remaining: [] };
  if (!phaseDir) return result;

  let entries;
  try {
    entries = fs.readdirSync(phaseDir);
  } catch {
    return result;
  }

  // Collect plan files (e.g., "04-01-PLAN.md") and summary files ("04-01-SUMMARY.md")
  const planFiles = entries.filter(f => /-PLAN\.md$/i.test(f)).sort();
  const summaryIds = new Set(
    entries
      .filter(f => /-SUMMARY\.md$/i.test(f))
      .map(f => f.replace(/-SUMMARY\.md$/i, ''))
  );

  for (const planFile of planFiles) {
    const id = planFile.replace(/-PLAN\.md$/i, '');
    const planPath = path.join(phaseDir, planFile);
    const content = safeReadFile(planPath) || '';
    const fm = extractFrontmatter(content);
    const planNumber = fm.plan || id.split('-').pop();
    // Try to pull a name from the <objective> or first heading
    const nameMatch = content.match(/<name>\s*([^<\n]+)/i)
      || content.match(/^#\s+(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : id;

    const entry = {
      id: planNumber,
      name,
      status: summaryIds.has(id) ? 'done' : 'not_started',
    };
    if (summaryIds.has(id)) {
      result.completed.push(entry);
    } else {
      result.remaining.push(entry);
    }
  }

  return result;
}

// ─── Core: generateCheckpoint ────────────────────────────────────────────────

/**
 * Gather checkpoint data and return a HANDOFF.json object.
 * Does NOT write to disk. Callers should use writeCheckpoint() to persist.
 *
 * @param {string} cwd - project root directory
 * @param {object} options
 * @param {string} [options.source] - "auto-compact" | "manual-pause" | "auto-postool" (default: "manual-pause")
 * @param {string} [options.contextNotes] - additional context from caller
 * @param {boolean} [options.partial] - flag set when caller hit a timeout (default: false)
 * @returns {object} HANDOFF.json data (19 fields)
 */
function generateCheckpoint(cwd, options = {}) {
  const source = options.source || 'manual-pause';
  const callerPartial = options.partial === true;
  const callerNotes = options.contextNotes || '';
  const isAutomatic = source === 'auto-compact' || source === 'auto-postool';

  // Default skeleton — every field present so callers can rely on the shape
  // even when gathering fails.
  const data = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    source,
    partial: callerPartial,
    phase: null,
    phase_name: null,
    phase_dir: null,
    plan: null,
    task: null,
    total_tasks: null,
    status: isAutomatic ? 'auto-checkpoint' : 'paused',
    completed_tasks: [],
    remaining_tasks: [],
    blockers: [],
    human_actions_pending: [],
    decisions: [],
    uncommitted_files: [],
    next_action: null,
    context_notes: callerNotes,
  };

  // ── 1. Read STATE.md (graceful on missing) ────────────────────────────────
  let stateContent = '';
  try {
    const statePath = planningPaths(cwd).state;
    stateContent = safeReadFile(statePath) || '';
  } catch {
    data.partial = true;
  }

  let stateBody = stateContent;
  let stateFm = {};
  if (stateContent) {
    try {
      stateFm = extractFrontmatter(stateContent) || {};
      // Strip the frontmatter block from the body for section parsing
      stateBody = stateContent.replace(/^---\r?\n[\s\S]+?\r?\n---\r?\n?/, '');
    } catch {
      data.partial = true;
    }
  }

  // ── 2. Parse phase/plan/task position ─────────────────────────────────────
  const phaseLine = extractBodyField(stateBody, 'Phase');
  const parsedPhase = parsePhaseLine(phaseLine);
  if (parsedPhase.number) data.phase = parsedPhase.number;
  if (parsedPhase.name) data.phase_name = parsedPhase.name;

  const planLine = extractBodyField(stateBody, 'Plan');
  if (planLine && !/not started/i.test(planLine)) {
    // Try to extract a number from "01" or "Plan 1" or "01 - name"
    const numMatch = planLine.match(/(\d+)/);
    data.plan = numMatch ? numMatch[1] : planLine;
  }

  const taskLine = extractBodyField(stateBody, 'Task');
  if (taskLine) {
    const numMatch = taskLine.match(/(\d+)/);
    data.task = numMatch ? parseInt(numMatch[1], 10) : taskLine;
  }

  const statusLine = extractBodyField(stateBody, 'Status');
  if (statusLine) {
    data.next_action = statusLine;
  }

  // ── 3. Resolve phase directory via findPhaseInternal ──────────────────────
  if (data.phase) {
    try {
      const phaseInfo = findPhaseInternal(cwd, data.phase);
      if (phaseInfo && phaseInfo.found) {
        data.phase_dir = phaseInfo.directory;
        // If we didn't get a name from STATE.md, use the one from the phase dir
        if (!data.phase_name && phaseInfo.phase_name) {
          data.phase_name = phaseInfo.phase_name;
        }

        // Build completed/remaining from the phase dir contents
        try {
          const abs = path.isAbsolute(phaseInfo.directory)
            ? phaseInfo.directory
            : path.join(cwd, phaseInfo.directory);
          const { completed, remaining } = scanPhasePlans(abs);
          data.completed_tasks = completed;
          data.remaining_tasks = remaining;
          if (data.total_tasks === null) {
            data.total_tasks = completed.length + remaining.length;
          }
        } catch {
          data.partial = true;
        }
      }
    } catch {
      data.partial = true;
    }
  }

  // ── 4. Uncommitted files (git status --porcelain) ─────────────────────────
  try {
    const result = execGit(cwd, ['status', '--porcelain']);
    if (result && result.exitCode === 0) {
      data.uncommitted_files = parsePorcelain(result.stdout);
    } else {
      // Non-zero exit (not a git repo, etc.) — leave empty, flag partial
      data.partial = true;
    }
  } catch {
    data.partial = true;
  }

  // ── 5. Recent git commits (for context_notes) ─────────────────────────────
  let recentCommits = '';
  try {
    const result = execGit(cwd, ['log', '--oneline', '-5']);
    if (result && result.exitCode === 0 && result.stdout) {
      recentCommits = result.stdout;
    }
  } catch {
    // Non-fatal — context_notes just won't include git history
  }

  // ── 6. Decisions / Blockers from STATE.md "Accumulated Context" ───────────
  const decisionsSection = extractSection(stateBody, 'Decisions');
  const decisionBullets = extractBullets(decisionsSection);
  if (decisionBullets.length > 0) {
    data.decisions = decisionBullets.map(text => ({
      decision: text,
      rationale: '',
      phase: data.phase || null,
    }));
  }

  const blockersSection = extractSection(stateBody, 'Blockers/Concerns')
    || extractSection(stateBody, 'Blockers');
  const blockerBullets = extractBullets(blockersSection);
  if (blockerBullets.length > 0) {
    data.blockers = blockerBullets.map(text => ({
      description: text,
      type: 'technical',
      workaround: '',
    }));
  }

  // ── 7. Compose context_notes ──────────────────────────────────────────────
  const noteParts = [];
  if (callerNotes) noteParts.push(callerNotes);
  if (statusLine) noteParts.push(`Status: ${statusLine}`);
  if (stateFm.stopped_at) noteParts.push(`Stopped at: ${stateFm.stopped_at}`);
  if (recentCommits) noteParts.push(`Recent commits:\n${recentCommits}`);
  data.context_notes = noteParts.join('\n\n');

  return data;
}

// ─── writeCheckpoint ─────────────────────────────────────────────────────────

/**
 * Generate a checkpoint and write it to `.planning/HANDOFF.json`.
 * Overwrites any existing file (D-05). Returns the data object on success.
 * Never throws — on failure returns a best-effort object with partial=true.
 *
 * Two guards prevent destructive no-op writes for automatic sources
 * (auto-postool, auto-compact):
 *   (a) If `.planning/` does not exist the cwd is not a GSD project -- never
 *       create the directory or the file.
 *   (b) If the checkpoint has no active phase and no active task it is a
 *       trivial skeleton -- writing it would blank out any hand-authored
 *       HANDOFF.json that may exist. Skip the write.
 * Manual pause (source: "manual-pause") bypasses guard (b) so an explicit
 * /bm:pause-work in an idle project still produces the expected file.
 */
function writeCheckpoint(cwd, options = {}) {
  const data = generateCheckpoint(cwd, options);
  try {
    const planningDirPath = planningPaths(cwd).planning;

    // Guard (a): refuse to create .planning/ -- only write into an existing one.
    if (!fs.existsSync(planningDirPath)) {
      return data;
    }

    // Guard (b): skip trivial (phase:null, task:null) checkpoints for automatic
    // sources. A trivial write would destroy hand-authored HANDOFF.json content
    // in idle GSD projects. Only an explicit manual pause may write a trivial
    // skeleton; every other source (current auto-postool, auto-compact, and any
    // future automatic caller) is treated as automatic by default so a new
    // source can never silently bypass this guard.
    const isManualPause = options.source === 'manual-pause';
    if (!isManualPause && data.phase === null && data.task === null) {
      return data;
    }

    const outPath = path.join(planningDirPath, 'HANDOFF.json');
    // Serialize concurrent writers (e.g. two enabled plugins racing on the same
    // PostToolUse/PreCompact write) through the same O_EXCL lock STATE.md uses,
    // and write via the temp-file + atomic-rename helper so a lock-less reader
    // can never observe a truncated, mid-write file. Mirrors writeStateMd.
    const lockPath = acquireStateLock(outPath);
    try {
      platformWriteSync(outPath, JSON.stringify(data, null, 2) + '\n');
    } finally {
      releaseStateLock(lockPath);
    }
  } catch {
    // Flag partial but don't throw -- PreCompact has a 5s budget and must not crash.
    data.partial = true;
  }
  return data;
}

// ─── deleteCheckpoint ────────────────────────────────────────────────────────

/**
 * Remove `.planning/HANDOFF.json` if it exists.
 *
 * Idempotent: returning `{ deleted: false }` when the file is not present is a
 * success, not a failure. Callers (resume skill, CLI) can ignore the return value.
 *
 * Never throws — LIFE-01 says the file must be gone after resume; failing loudly
 * would turn a lifecycle hygiene step into a user-visible error on the happy path.
 *
 * @param {string} cwd - project root directory
 * @returns {{ deleted: boolean, path: string, error?: string }}
 */
function deleteCheckpoint(cwd) {
  let outPath;
  try {
    outPath = path.join(planningPaths(cwd).planning, 'HANDOFF.json');
  } catch (err) {
    return { deleted: false, path: '', error: err && err.message ? err.message : 'planningPaths failed' };
  }

  if (!fs.existsSync(outPath)) {
    return { deleted: false, path: outPath };
  }

  try {
    fs.unlinkSync(outPath);
    return { deleted: true, path: outPath };
  } catch (err) {
    return { deleted: false, path: outPath, error: err && err.message ? err.message : 'unlink failed' };
  }
}

// ─── CLI command handler ─────────────────────────────────────────────────────

/**
 * CLI handler for `node gsd-tools.cjs checkpoint [--source S] [--context-notes "..."]`.
 * Writes HANDOFF.json and emits the data as JSON on stdout.
 */
function cmdCheckpoint(cwd, args, raw) {
  // --clear branch: delete HANDOFF.json instead of writing one (LIFE-01).
  // This must come before any other flag parsing — --clear is a mode switch,
  // not a modifier, and the writeCheckpoint path below must be unreachable
  // when --clear is set.
  if (args.includes('--clear')) {
    const result = deleteCheckpoint(cwd);
    if (result.deleted) {
      try {
        process.stderr.write('GSD: checkpoint cleared from .planning/HANDOFF.json\n');
      } catch { /* stderr closed — ignore */ }
    } else if (result.error) {
      try {
        process.stderr.write('GSD: checkpoint clear failed: ' + result.error + '\n');
      } catch { /* stderr closed — ignore */ }
    }
    // If neither deleted nor errored, the file simply wasn't there — that's
    // success (idempotent per LIFE-01 / D-09).
    output(result, raw);
    return;
  }

  // Parse --source flag (default: manual-pause)
  let source = 'manual-pause';
  const sourceIdx = args.indexOf('--source');
  if (sourceIdx !== -1 && args[sourceIdx + 1] && !args[sourceIdx + 1].startsWith('--')) {
    source = args[sourceIdx + 1];
  }

  // Parse --context-notes flag (optional string)
  let contextNotes = '';
  const notesIdx = args.indexOf('--context-notes');
  if (notesIdx !== -1 && args[notesIdx + 1] !== undefined) {
    contextNotes = args[notesIdx + 1];
  }

  // Parse --partial boolean flag (rarely used by CLI but supported for testing)
  const partial = args.includes('--partial');

  const data = writeCheckpoint(cwd, { source, contextNotes, partial });

  try {
    process.stderr.write('GSD: checkpoint saved to .planning/HANDOFF.json\n');
  } catch { /* stderr closed — ignore */ }

  output(data, raw);
}

module.exports = {
  generateCheckpoint,
  writeCheckpoint,
  deleteCheckpoint,
  cmdCheckpoint,
};
