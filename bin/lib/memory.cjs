/**
 * Memory — Phase memory writer for Claude Code's memdir auto-memory system
 *
 * Writes lean, durable `project` memory files at phase completion time.
 * Each completed phase produces one memory file in the auto-memory directory
 * and one index entry in MEMORY.md.
 *
 * Content policy (from CONTEXT.md):
 * - Include: phase goal achievement, non-obvious decisions (with rationale),
 *   surprising blocker resolutions
 * - Exclude: anything derivable from git log, code inspection, or CLAUDE.md
 *
 * File contract:
 * - Path: <autoMemPath>/phase-NN-slug.md (stable, idempotent)
 * - MEMORY.md: index with one-line pointers per phase
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Minimal helpers (avoid pulling in full core.cjs at import time) ────────

/**
 * Resolve the .planning directory for a project root.
 * Checks for workstream override via GSD_WORKSTREAM env var.
 */
function resolvePlanningDir(cwd) {
  const ws = process.env.GSD_WORKSTREAM;
  if (ws) {
    const wsDir = path.join(cwd, '.planning', 'workstreams', ws);
    if (fs.existsSync(wsDir)) return wsDir;
  }
  return path.join(cwd, '.planning');
}

/**
 * Simple YAML-like frontmatter extractor.
 * Returns { data: object, body: string } or null.
 */
function extractSimpleFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };

  const fmText = match[1];
  const body = match[2];
  const data = {};

  // Simple key: value parser (handles strings, arrays with brackets)
  for (const line of fmText.split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    let val = kvMatch[2].trim();

    // Handle arrays like [item1, item2]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    } else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }

  return { data, body };
}

/**
 * Output result to stdout as JSON.
 */
function outputResult(result, raw, rawText) {
  if (raw && rawText) {
    process.stdout.write(String(rawText));
  } else {
    process.stdout.write(JSON.stringify(result, null, 2));
  }
}

/**
 * Print error and exit.
 */
function exitError(msg) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

// ─── Auto-memory path resolution ────────────────────────────────────────────
// Mirrors Claude Code's memdir/paths.ts logic:
//   <configHome>/projects/<sanitized-cwd>/memory/
// where configHome = CLAUDE_CODE_REMOTE_MEMORY_DIR || ~/.claude
// and sanitized-cwd replaces non-alphanumeric chars with hyphens.

/**
 * Sanitize a path segment for use as a directory name.
 * Mirrors Claude Code's sanitizePath: replace non-alphanumeric with hyphens.
 */
function sanitizePath(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Find the canonical git root for the project.
 * Uses .git to find the main worktree root (for worktree-shared memory).
 */
function findCanonicalGitRoot(cwd) {
  try {
    const { execSync } = require('child_process');
    // git rev-parse --path-format=absolute --git-common-dir gives the shared .git dir
    const gitCommonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    // The canonical root is the parent of .git (common dir)
    if (gitCommonDir && gitCommonDir !== '.git') {
      return path.dirname(gitCommonDir);
    }
  } catch {
    // Not a git repo or git not available
  }
  return cwd;
}

/**
 * Resolve the auto-memory directory path.
 * Follows Claude Code's resolution order:
 *   1. CLAUDE_COWORK_MEMORY_PATH_OVERRIDE (full path override)
 *   2. <memoryBase>/projects/<sanitized-git-root>/memory/
 *      where memoryBase = CLAUDE_CODE_REMOTE_MEMORY_DIR || ~/.claude
 */
function getAutoMemPath(cwd) {
  // Full override (Cowork/SDK)
  if (process.env.CLAUDE_COWORK_MEMORY_PATH_OVERRIDE) {
    const override = process.env.CLAUDE_COWORK_MEMORY_PATH_OVERRIDE;
    if (path.isAbsolute(override)) {
      return override.endsWith(path.sep) ? override : override + path.sep;
    }
  }

  const memoryBase = process.env.CLAUDE_CODE_REMOTE_MEMORY_DIR ||
    path.join(os.homedir(), '.claude');
  const gitRoot = findCanonicalGitRoot(cwd);
  const sanitized = sanitizePath(gitRoot);
  return path.join(memoryBase, 'projects', sanitized, 'memory') + path.sep;
}

/**
 * Resolve the MEMORY.md entrypoint path.
 */
function getAutoMemEntrypoint(cwd) {
  return path.join(getAutoMemPath(cwd), 'MEMORY.md');
}

// ─── Phase memory payload construction ──────────────────────────────────────

/**
 * Build a lean, durable phase memory payload from planning artifacts.
 *
 * Reads CONTEXT.md, VERIFICATION.md (if present), and all SUMMARY.md files
 * for the given phase. Distills into a `project`-type memory containing:
 * - Phase outcome (one sentence)
 * - Non-obvious decisions with rationale
 * - Surprising blocker resolutions
 *
 * Does NOT include:
 * - Raw file inventories or git log dumps
 * - Anything derivable from code inspection or CLAUDE.md
 *
 * @param {string} cwd - Project root
 * @param {string} phaseNumber - Phase number (e.g., "03")
 * @returns {{ filename: string, content: string, description: string } | null}
 */
function buildPhaseMemoryPayload(cwd, phaseNumber) {
  const pDir = resolvePlanningDir(cwd);

  // Find phase directory
  let phaseDir = null;
  const phasesRoot = path.join(pDir, 'phases');
  if (!fs.existsSync(phasesRoot)) return null;

  const allDirs = fs.readdirSync(phasesRoot);
  const paddedNum = String(phaseNumber).padStart(2, '0');
  for (const d of allDirs) {
    if (d.startsWith(paddedNum + '-')) {
      phaseDir = path.join(phasesRoot, d);
      break;
    }
  }
  if (!phaseDir || !fs.existsSync(phaseDir)) return null;

  const phaseDirName = path.basename(phaseDir);
  const phaseSlug = phaseDirName.replace(/^\d+-/, '');

  // Read CONTEXT.md for phase goal and resolved decisions
  let contextContent = '';
  const contextPath = path.join(phaseDir, `${paddedNum}-CONTEXT.md`);
  if (fs.existsSync(contextPath)) {
    contextContent = fs.readFileSync(contextPath, 'utf-8');
  }

  // Extract phase goal from CONTEXT.md
  const goalMatch = contextContent.match(/^## Phase Goal\s*\n([\s\S]*?)(?=\n##|\n$)/m);
  const phaseGoal = goalMatch ? goalMatch[1].trim() : '';

  // Extract resolved decisions from CONTEXT.md
  const decisions = extractResolvedDecisions(contextContent);

  // Read VERIFICATION.md for outcome summary (if exists)
  let verificationContent = '';
  const verificationPath = path.join(phaseDir, `${paddedNum}-VERIFICATION.md`);
  if (fs.existsSync(verificationPath)) {
    verificationContent = fs.readFileSync(verificationPath, 'utf-8');
  }

  // Read all SUMMARY.md files for the phase
  const phaseFiles = fs.readdirSync(phaseDir);
  const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));
  const summaryDecisions = [];
  const summaryBlockers = [];

  for (const sf of summaryFiles) {
    const summaryPath = path.join(phaseDir, sf);
    const summaryContent = fs.readFileSync(summaryPath, 'utf-8');

    // Extract decisions from summaries (look in frontmatter and body)
    const fmResult = extractSimpleFrontmatter(summaryContent);
    if (fmResult && fmResult.data) {
      const fm = fmResult.data;
      if (fm.decisions && Array.isArray(fm.decisions)) {
        for (const d of fm.decisions) {
          if (typeof d === 'string' && d.trim()) {
            summaryDecisions.push(d.trim());
          } else if (d && d.decision) {
            summaryDecisions.push(d.decision + (d.rationale ? ` (${d.rationale})` : ''));
          }
        }
      }
    }

    // Extract deviations (surprising blockers)
    const deviationSection = summaryContent.match(/## Deviations from Plan\s*\n([\s\S]*?)(?=\n## |\n$)/);
    if (deviationSection) {
      const devText = deviationSection[1].trim();
      if (devText && !devText.match(/^None/i)) {
        // Extract individual deviation descriptions
        const devMatches = devText.match(/\*\*\d+\.\s*\[.*?\]\s*(.*?)$/gm);
        if (devMatches) {
          for (const dm of devMatches) {
            const cleaned = dm
              .replace(/^\*\*\d+\.\s*\[.*?\]\s*/, '')  // strip leading **N. [Type]
              .replace(/\*\*$/,  '')                      // strip trailing **
              .trim();
            if (cleaned) summaryBlockers.push(cleaned);
          }
        }
      }
    }
  }

  // Build outcome summary
  let outcome = '';
  if (verificationContent) {
    // Try to extract overall result from verification
    const resultMatch = verificationContent.match(/(?:status|result|outcome)\s*[:=]\s*(.+)/i);
    if (resultMatch) {
      outcome = resultMatch[1].trim();
    }
  }
  if (!outcome && phaseGoal) {
    outcome = phaseGoal;
  }

  // Merge decisions: context decisions take priority (they have rationale),
  // then summary decisions that aren't duplicates
  const allDecisions = [...decisions];
  for (const sd of summaryDecisions) {
    const lowerSd = sd.toLowerCase();
    const isDuplicate = allDecisions.some(d =>
      d.text.toLowerCase().includes(lowerSd.slice(0, 30)) ||
      lowerSd.includes(d.text.toLowerCase().slice(0, 30))
    );
    if (!isDuplicate) {
      allDecisions.push({ text: sd, rationale: '' });
    }
  }

  // Filter to non-obvious decisions only (skip trivial ones)
  const keyDecisions = allDecisions.filter(d => {
    const text = d.text.toLowerCase();
    // Skip decisions that are just tool/file choices derivable from code
    if (text.match(/^(use|chose|selected) (the )?[a-z]+ (library|package|module)$/)) return false;
    return true;
  });

  // Build filename
  const filename = `phase-${paddedNum}-${phaseSlug}.md`;

  // Build one-line description for relevance matching
  const description = outcome
    ? `Phase ${phaseNumber}: ${phaseSlug.replace(/-/g, ' ')} -- ${outcome.slice(0, 80)}`
    : `Phase ${phaseNumber}: ${phaseSlug.replace(/-/g, ' ')} completed`;

  // Build memory content
  const lines = [];
  lines.push('---');
  lines.push(`name: phase-${paddedNum}-${phaseSlug}`);
  lines.push(`description: ${description}`);
  lines.push('type: project');
  lines.push('---');
  lines.push('');
  lines.push(`Phase ${phaseNumber}: ${phaseSlug.replace(/-/g, ' ')} -- ${outcome || 'completed'}`);
  lines.push('');

  if (keyDecisions.length > 0) {
    lines.push('**Key decisions:**');
    for (const d of keyDecisions) {
      const entry = d.rationale ? `${d.text} (${d.rationale})` : d.text;
      lines.push(`- ${entry}`);
    }
    lines.push('');
  }

  if (summaryBlockers.length > 0) {
    lines.push('**Surprising blockers resolved:**');
    for (const b of summaryBlockers) {
      lines.push(`- ${b}`);
    }
    lines.push('');
  }

  // Why and How to apply sections (required by memdir project type contract)
  const whyParts = [];
  if (keyDecisions.length > 0) {
    whyParts.push('these decisions were driven by project constraints and phase outcomes');
  }
  if (summaryBlockers.length > 0) {
    whyParts.push('blockers required non-obvious solutions that should inform future phases');
  }
  if (whyParts.length === 0) {
    whyParts.push('phase completed as planned with no significant deviations');
  }

  lines.push(`**Why:** ${whyParts.join('; ')}.`);
  lines.push(`**How to apply:** When working on follow-up phases or related features, reference these decisions and outcomes to avoid re-discovering the same constraints.`);

  return {
    filename,
    content: lines.join('\n') + '\n',
    description,
  };
}

/**
 * Extract resolved decisions from CONTEXT.md content.
 * Looks for "## Resolved Decisions" section with numbered subsections.
 *
 * @param {string} content - CONTEXT.md content
 * @returns {Array<{text: string, rationale: string}>}
 */
function extractResolvedDecisions(content) {
  const decisions = [];

  // Find the Resolved Decisions section
  const resolvedSection = content.match(/## Resolved Decisions\s*\n([\s\S]*?)(?=\n## [^#]|\n$)/);
  if (!resolvedSection) return decisions;

  const sectionText = resolvedSection[1];

  // Parse numbered subsections: ### N. Title -> Arrow text
  const subsections = sectionText.split(/(?=### \d+\.)/);
  for (const sub of subsections) {
    const headerMatch = sub.match(/### \d+\.\s*(.+?)(?:\s*$|\n)/);
    if (!headerMatch) continue;

    const headerText = headerMatch[1].trim();
    // The arrow pattern separates title from decision
    const arrowMatch = headerText.match(/(.+?)\s*(?:->|-->|=>)\s*(.+)/);

    let decisionText = '';
    let rationale = '';

    if (arrowMatch) {
      decisionText = `${arrowMatch[1].trim()}: ${arrowMatch[2].trim()}`;
    } else {
      decisionText = headerText;
    }

    // Extract bullet points as rationale (first line after header with -)
    const bullets = sub.match(/^- (.+)/gm);
    if (bullets && bullets.length > 0) {
      rationale = bullets[0].replace(/^- /, '').trim();
    }

    decisions.push({ text: decisionText, rationale });
  }

  return decisions;
}

// ─── MEMORY.md index management ─────────────────────────────────────────────

/**
 * Update or create MEMORY.md index with a pointer to the phase memory file.
 *
 * @param {string} memoryDir - Auto-memory directory path
 * @param {string} filename - Memory file name (e.g., "phase-03-plugin-packaging.md")
 * @param {string} description - One-line description for the index
 */
function updateMemoryIndex(memoryDir, filename, description) {
  const entrypointPath = path.join(memoryDir, 'MEMORY.md');

  let content = '';
  if (fs.existsSync(entrypointPath)) {
    content = fs.readFileSync(entrypointPath, 'utf-8');
  }

  // Build the index line
  const indexLine = `- [${filename}](./${filename}): ${description}`;

  // Check if this file is already indexed
  const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingPattern = new RegExp(`^- \\[${escapedFilename}\\].*$`, 'm');

  if (existingPattern.test(content)) {
    // Update existing entry
    content = content.replace(existingPattern, indexLine);
  } else {
    // Add new entry
    if (!content.trim()) {
      // Create fresh MEMORY.md
      content = `# Project Memory\n\nPhase outcomes and key decisions from GSD workflow.\n\n## Phase Memories\n\n${indexLine}\n`;
    } else if (content.includes('## Phase Memories')) {
      // Append to existing section
      content = content.replace(
        /(## Phase Memories\n(?:[\s\S]*?))((?=\n## )|$)/,
        `$1${indexLine}\n`
      );
    } else {
      // Append new section
      content = content.trimEnd() + `\n\n## Phase Memories\n\n${indexLine}\n`;
    }
  }

  fs.writeFileSync(entrypointPath, content, 'utf-8');
}

// ─── CLI command ────────────────────────────────────────────────────────────

/**
 * Write phase memory to Claude Code's auto-memory system.
 *
 * Usage: gsd-tools write-phase-memory <phase-number>
 *
 * @param {string} cwd - Project root
 * @param {string} phaseNumber - Phase number (e.g., "03" or "3")
 * @param {boolean} raw - Raw output mode
 */
function cmdWritePhaseMemory(cwd, phaseNumber, raw) {
  if (!phaseNumber) {
    exitError('Usage: gsd-tools write-phase-memory <phase-number>');
  }

  // Build the memory payload
  const payload = buildPhaseMemoryPayload(cwd, phaseNumber);
  if (!payload) {
    exitError(`Could not build memory payload for phase ${phaseNumber}. Phase directory not found or no artifacts.`);
  }

  // Resolve auto-memory path
  const memoryDir = getAutoMemPath(cwd);

  // Ensure directory exists
  fs.mkdirSync(memoryDir, { recursive: true });

  // Write memory file (stable filename = idempotent)
  const memoryFilePath = path.join(memoryDir, payload.filename);
  fs.writeFileSync(memoryFilePath, payload.content, 'utf-8');

  // Update MEMORY.md index
  updateMemoryIndex(memoryDir, payload.filename, payload.description);

  const result = {
    written: true,
    file: memoryFilePath,
    index: path.join(memoryDir, 'MEMORY.md'),
    filename: payload.filename,
    description: payload.description,
    memoryDir,
  };

  outputResult(result, raw, `Phase memory written: ${memoryFilePath}`);
}

// ─── Ad-hoc decision memory (quick / debug / fast close-out capture) ─────────

const VALID_DECISION_TYPES = new Set(['user', 'feedback', 'project', 'reference']);

/**
 * Append (or update) a flat MEMORY.md index line for a decision memory.
 *
 * Unlike updateMemoryIndex (which maintains a "## Phase Memories" section),
 * this matches the flat one-line-per-memory format the auto-memory spec uses
 * for hand-curated memories: `- [Title](slug.md): hook`. Dedup is by the
 * `(slug.md)` link target, so re-running with the same slug updates in place.
 *
 * @param {string} memoryDir - Resolved auto-memory directory
 * @param {string} slug - Memory slug (filename without .md)
 * @param {string} title - Human title shown in the index
 * @param {string} hook - One-line description / relevance hook
 */
function appendDecisionIndex(memoryDir, slug, title, hook) {
  const entrypointPath = path.join(memoryDir, 'MEMORY.md');
  let content = fs.existsSync(entrypointPath)
    ? fs.readFileSync(entrypointPath, 'utf-8')
    : '';

  const indexLine = `- [${title}](${slug}.md): ${hook}`;
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match any existing flat-list line that links to this slug.md
  const existingPattern = new RegExp(`^- \\[[^\\]]*\\]\\(${escapedSlug}\\.md\\):.*$`, 'm');

  if (existingPattern.test(content)) {
    content = content.replace(existingPattern, indexLine);
  } else if (!content.trim()) {
    content = `${indexLine}\n`;
  } else {
    // Insert after the last top-level "- [" list entry to keep the flat list
    // contiguous; fall back to end-of-file if there is no list yet.
    const lines = content.split('\n');
    let lastEntry = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^- \[/.test(lines[i])) lastEntry = i;
    }
    if (lastEntry >= 0) {
      lines.splice(lastEntry + 1, 0, indexLine);
      content = lines.join('\n');
    } else {
      content = content.trimEnd() + `\n${indexLine}\n`;
    }
  }

  fs.writeFileSync(entrypointPath, content, 'utf-8');
}

/**
 * Write an ad-hoc "durable decision" memory captured at the close-out of a
 * quick / debug / fast task. The CONTENT is composed by the orchestrating
 * model (durability is a judgment call); this helper only resolves the
 * correct auto-memory path, assembles consistent frontmatter, writes the
 * file idempotently by slug, and flat-indexes it in MEMORY.md.
 *
 * Usage: gsd-tools write-decision-memory --slug <slug> --title <title> \
 *          --description <hook> --type <user|feedback|project|reference> \
 *          --body-file <path>   (use '-' to read body from stdin)
 *
 * @param {string} cwd - Project root
 * @param {object} opts - { slug, title, description, type, bodyFile }
 * @param {boolean} raw - Raw output mode
 */
function cmdWriteDecisionMemory(cwd, opts, raw) {
  const { slug, title, description, type, bodyFile } = opts || {};
  if (!slug || !description || !type || !bodyFile) {
    exitError('Usage: gsd-tools write-decision-memory --slug <slug> --title <title> --description <hook> --type <user|feedback|project|reference> --body-file <path|->');
  }
  // Slug must be filesystem-safe and match the memory spec's kebab-case shape.
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug)) {
    exitError(`Invalid slug '${slug}': use lowercase kebab/snake-case, max 80 chars, no path separators.`);
  }
  if (!VALID_DECISION_TYPES.has(type)) {
    exitError(`Invalid type '${type}': must be one of user, feedback, project, reference.`);
  }

  let body;
  try {
    body = bodyFile === '-'
      ? fs.readFileSync(0, 'utf-8')
      : fs.readFileSync(bodyFile, 'utf-8');
  } catch (err) {
    exitError(`Could not read --body-file '${bodyFile}': ${err && err.message ? err.message : err}`);
  }
  if (!body.trim()) {
    exitError('Refusing to write an empty decision memory (body is blank).');
  }

  const displayTitle = title && title.trim() ? title.trim() : slug;
  const frontmatter =
    `---\n` +
    `name: ${slug}\n` +
    `description: ${description.replace(/\n/g, ' ').trim()}\n` +
    `metadata:\n` +
    `  type: ${type}\n` +
    `---\n\n`;

  const memoryDir = getAutoMemPath(cwd);
  fs.mkdirSync(memoryDir, { recursive: true });

  const filename = `${slug}.md`;
  const memoryFilePath = path.join(memoryDir, filename);
  fs.writeFileSync(memoryFilePath, frontmatter + body.trim() + '\n', 'utf-8');

  appendDecisionIndex(memoryDir, slug, displayTitle, description.replace(/\n/g, ' ').trim());

  outputResult(
    {
      written: true,
      file: memoryFilePath,
      index: path.join(memoryDir, 'MEMORY.md'),
      filename,
      slug,
      type,
      memoryDir,
    },
    raw,
    `Saved memory: ${slug}`
  );
}

module.exports = {
  buildPhaseMemoryPayload,
  getAutoMemPath,
  getAutoMemEntrypoint,
  updateMemoryIndex,
  appendDecisionIndex,
  cmdWritePhaseMemory,
  cmdWriteDecisionMemory,
};
