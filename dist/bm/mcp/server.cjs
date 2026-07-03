#!/usr/bin/env node

/**
 * GSD MCP Server -- Packaged plugin MCP server
 *
 * Exposes GSD project state as MCP resources and workflow mutation tools.
 * Designed to run from ${CLAUDE_PLUGIN_ROOT}/mcp/server.cjs via plugin manifest.
 *
 * Resources (read-only):
 *   gsd://state       - Project state (STATE.md frontmatter as JSON)
 *   gsd://roadmap     - Project roadmap (ROADMAP.md as markdown)
 *   gsd://requirements - Requirements (REQUIREMENTS.md as markdown)
 *   gsd://config      - Project config (.planning/config.json as JSON)
 *   gsd://phase/{N}   - Phase summary (JSON)
 *   gsd://phase/{N}/context - Phase context (CONTEXT.md as markdown)
 *
 * Tools (mutations):
 *   gsd_init_phase, gsd_plan_status, gsd_advance_plan, gsd_record_metric,
 *   gsd_transition_phase, gsd_add_decision, gsd_add_blocker,
 *   gsd_resolve_blocker, gsd_record_session, gsd_commit_docs
 *
 * Transport: stdio (stdin/stdout JSON-RPC)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// Resolve GSD bin/lib from plugin root (server lives at <root>/mcp/server.cjs)
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const libDir = path.join(pluginRoot, 'bin', 'lib');
const gsdTools = path.join(pluginRoot, 'bin', 'gsd-tools.cjs');

// Spawn gsd-tools.cjs to dispatch a state subcommand through
// bin/lib/state-command-router.cjs (the canonical argv-shape router).
// Routes ALL state mutations through the same code path as CLI use, so any
// future state.cjs refactor stays in sync with no MCP-specific drift. See #11
// (the reason this exists: the previous in-process captureCmd approach poked
// at state.cmd* exports directly and broke when state.cjs renamed them to
// cmdState*). Also: bin/lib/core.cjs::output() writes via fs.writeSync(1, ...)
// which bypasses process.stdout.write intercepts, making in-process capture
// fundamentally unreliable, so spawn-and-capture is the durable fix.
function runStateSubcommand(subcommand, argvExtras, defaultText) {
  const argv = ['state', subcommand, ...argvExtras];
  const result = spawnSync('node', [gsdTools, ...argv], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    timeout: 10000,
  });
  if (result.error) {
    return { content: [{ type: 'text', text: `gsd-tools spawn failed: ${result.error.message}` }], isError: true };
  }
  if (result.status !== 0) {
    const errText = (result.stderr || result.stdout || `gsd-tools exited ${result.status}`).trim();
    return { content: [{ type: 'text', text: errText || defaultText }], isError: true };
  }
  return { content: [{ type: 'text', text: (result.stdout || '').trim() || defaultText }] };
}

// Import GSD library modules
let core, state, roadmap, frontmatter, phase;
try {
  core = require(path.join(libDir, 'core.cjs'));
  state = require(path.join(libDir, 'state.cjs'));
  roadmap = require(path.join(libDir, 'roadmap.cjs'));
  frontmatter = require(path.join(libDir, 'frontmatter.cjs'));
  phase = require(path.join(libDir, 'phase.cjs'));
} catch (err) {
  // If lib modules are not available, the server will start but resources
  // will return errors. This allows graceful degradation during development.
  process.stderr.write(`GSD MCP: Warning -- could not load bin/lib modules: ${err.message}\n`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function findPlanningDir() {
  // Use CWD (the project root) to find .planning/
  const cwd = process.cwd();
  const planningDir = path.join(cwd, '.planning');
  if (fs.existsSync(planningDir)) return planningDir;
  return null;
}

/**
 * Capture output from a GSD command function that writes to stdout/exits.
 * Intercepts process.stdout.write and process.exit to capture the result safely.
 */
function captureCmd(fn, ...args) {
  const chunks = [];
  const origWrite = process.stdout.write;
  const origExit = process.exit;
  let exitCode = 0;

  process.stdout.write = function (chunk) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };

  process.exit = function (code) {
    exitCode = code || 0;
    throw new Error(`__GSD_EXIT_${exitCode}__`);
  };

  try {
    fn(...args);
  } catch (err) {
    if (!err.message || !err.message.startsWith('__GSD_EXIT_')) {
      throw err;
    }
  } finally {
    process.stdout.write = origWrite;
    process.exit = origExit;
  }

  return { output: chunks.join(''), exitCode };
}

// ─── Simple stdio JSON-RPC transport ────────────────────────────────────────

let requestBuffer = '';

// MCP stdio transport is newline-delimited JSON (ndjson).
// Current MCP clients (incl. Claude Code) expect one JSON object per line;
// the older LSP-style Content-Length framing is not part of the MCP spec
// and breaks the connection. See issue #3.
function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

function sendNotification(method, params) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

// ─── Resource handlers ──────────────────────────────────────────────────────

const resourceHandlers = {
  'gsd://state': () => {
    const planningDir = findPlanningDir();
    if (!planningDir) return { error: 'No .planning/ directory found' };
    const content = safeRead(path.join(planningDir, 'STATE.md'));
    if (!content) return { error: 'STATE.md not found' };
    // Parse frontmatter for structured data
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const lines = fmMatch[1].split('\n');
      const obj = {};
      for (const line of lines) {
        const m = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
        if (m) obj[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      return { contents: [{ uri: 'gsd://state', mimeType: 'application/json', text: JSON.stringify(obj, null, 2) }] };
    }
    return { contents: [{ uri: 'gsd://state', mimeType: 'text/markdown', text: content }] };
  },

  'gsd://roadmap': () => {
    const planningDir = findPlanningDir();
    if (!planningDir) return { error: 'No .planning/ directory found' };
    const content = safeRead(path.join(planningDir, 'ROADMAP.md'));
    if (!content) return { error: 'ROADMAP.md not found' };
    return { contents: [{ uri: 'gsd://roadmap', mimeType: 'text/markdown', text: content }] };
  },

  'gsd://requirements': () => {
    const planningDir = findPlanningDir();
    if (!planningDir) return { error: 'No .planning/ directory found' };
    const content = safeRead(path.join(planningDir, 'REQUIREMENTS.md'));
    if (!content) return { error: 'REQUIREMENTS.md not found' };
    return { contents: [{ uri: 'gsd://requirements', mimeType: 'text/markdown', text: content }] };
  },

  'gsd://config': () => {
    const planningDir = findPlanningDir();
    if (!planningDir) return { error: 'No .planning/ directory found' };
    const content = safeRead(path.join(planningDir, 'config.json'));
    if (!content) return { error: 'config.json not found' };
    return { contents: [{ uri: 'gsd://config', mimeType: 'application/json', text: content }] };
  }
};

function handlePhaseResource(phaseNum) {
  const planningDir = findPlanningDir();
  if (!planningDir) return { error: 'No .planning/ directory found' };

  const phasesDir = path.join(planningDir, 'phases');
  if (!fs.existsSync(phasesDir)) return { error: 'No phases/ directory found' };

  // Find the phase directory matching the number
  const prefix = String(phaseNum).padStart(2, '0');
  const entries = fs.readdirSync(phasesDir);
  const phaseDir = entries.find(e => e.startsWith(prefix + '-'));
  if (!phaseDir) return { error: `Phase ${phaseNum} not found` };

  const fullPath = path.join(phasesDir, phaseDir);
  // Collect plan and summary info
  const files = fs.readdirSync(fullPath);
  const plans = files.filter(f => f.endsWith('-PLAN.md'));
  const summaries = files.filter(f => f.endsWith('-SUMMARY.md'));

  return {
    contents: [{
      uri: `gsd://phase/${phaseNum}`,
      mimeType: 'application/json',
      text: JSON.stringify({
        phase: phaseNum,
        directory: phaseDir,
        plans: plans.length,
        summaries: summaries.length,
        files: files
      }, null, 2)
    }]
  };
}

function handlePhaseContextResource(phaseNum) {
  const planningDir = findPlanningDir();
  if (!planningDir) return { error: 'No .planning/ directory found' };

  const phasesDir = path.join(planningDir, 'phases');
  const prefix = String(phaseNum).padStart(2, '0');
  const entries = fs.readdirSync(phasesDir);
  const phaseDir = entries.find(e => e.startsWith(prefix + '-'));
  if (!phaseDir) return { error: `Phase ${phaseNum} not found` };

  const contextFile = path.join(phasesDir, phaseDir, `${prefix}-CONTEXT.md`);
  const content = safeRead(contextFile);
  if (!content) return { error: `CONTEXT.md not found for phase ${phaseNum}` };

  return {
    contents: [{
      uri: `gsd://phase/${phaseNum}/context`,
      mimeType: 'text/markdown',
      text: content
    }]
  };
}

// ─── Tool handlers ──────────────────────────────────────────────────────────

const toolDefinitions = [
  {
    name: 'gsd_plan_status',
    description: 'Get current GSD plan execution status',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'gsd_advance_plan',
    description: 'Advance the current plan counter in STATE.md',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'gsd_record_metric',
    description: 'Record execution metrics for a plan',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'Phase identifier (e.g., "01")' },
        plan: { type: 'string', description: 'Plan identifier (e.g., "02")' },
        duration: { type: 'string', description: 'Duration (e.g., "5min")' },
        tasks: { type: 'number', description: 'Number of tasks completed' },
        files: { type: 'number', description: 'Number of files modified' }
      },
      required: ['phase', 'plan', 'duration']
    }
  },
  {
    name: 'gsd_add_decision',
    description: 'Add a decision to STATE.md accumulated context',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'Phase where decision was made' },
        summary: { type: 'string', description: 'Decision summary text' }
      },
      required: ['summary']
    }
  },
  {
    name: 'gsd_add_blocker',
    description: 'Add a blocker to STATE.md',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Blocker description' }
      },
      required: ['text']
    }
  },
  {
    name: 'gsd_resolve_blocker',
    description: 'Remove a resolved blocker from STATE.md',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Blocker text to remove' }
      },
      required: ['text']
    }
  },
  {
    name: 'gsd_record_session',
    description: 'Update session continuity info in STATE.md',
    inputSchema: {
      type: 'object',
      properties: {
        stopped_at: { type: 'string', description: 'Description of where work stopped' }
      },
      required: ['stopped_at']
    }
  },
  {
    name: 'gsd_commit_docs',
    description: 'Commit planning documentation files',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
        files: { type: 'array', items: { type: 'string' }, description: 'Files to commit' }
      },
      required: ['message', 'files']
    }
  }
];

function handleToolCall(name, args) {
  try {
    switch (name) {
      case 'gsd_plan_status': {
        const planningDir = findPlanningDir();
        if (!planningDir) return { content: [{ type: 'text', text: 'No .planning/ directory found' }], isError: true };
        const stateContent = safeRead(path.join(planningDir, 'STATE.md'));
        if (!stateContent) return { content: [{ type: 'text', text: 'STATE.md not found' }], isError: true };
        return { content: [{ type: 'text', text: stateContent }] };
      }

      // Write tools route through bin/gsd-tools.cjs which dispatches via
      // bin/lib/state-command-router.cjs to state.cmdStateX(cwd, options, raw).
      // Same argv-shape as direct CLI use, so MCP and BashTool consumers run
      // through identical code paths and stay in sync across refactors. See
      // #11 (reported by @tinmanlab) for why this exists.
      case 'gsd_advance_plan': {
        return runStateSubcommand('advance-plan', ['--raw'], 'Plan advanced');
      }

      case 'gsd_record_metric': {
        const extras = ['--raw'];
        if (args.phase != null)    extras.push('--phase',    String(args.phase));
        if (args.plan != null)     extras.push('--plan',     String(args.plan));
        if (args.duration != null) extras.push('--duration', String(args.duration));
        if (args.tasks != null)    extras.push('--tasks',    String(args.tasks));
        if (args.files != null)    extras.push('--files',    String(args.files));
        return runStateSubcommand('record-metric', extras, 'Metric recorded');
      }

      case 'gsd_add_decision': {
        const extras = ['--raw', '--summary', String(args.summary || '')];
        if (args.phase != null)          extras.push('--phase',          String(args.phase));
        if (args.summary_file != null)   extras.push('--summary-file',   String(args.summary_file));
        if (args.rationale != null)      extras.push('--rationale',      String(args.rationale));
        if (args.rationale_file != null) extras.push('--rationale-file', String(args.rationale_file));
        return runStateSubcommand('add-decision', extras, 'Decision added');
      }

      case 'gsd_add_blocker': {
        const extras = ['--raw', '--text', String(args.text || '')];
        if (args.text_file != null) extras.push('--text-file', String(args.text_file));
        return runStateSubcommand('add-blocker', extras, 'Blocker added');
      }

      case 'gsd_resolve_blocker': {
        const extras = ['--raw', '--text', String(args.text || '')];
        return runStateSubcommand('resolve-blocker', extras, 'Blocker resolved');
      }

      case 'gsd_record_session': {
        // Per v2.45.0 state-handler preservation contract, omit --resume-file
        // when the caller did not pass one so the existing Resume File value
        // is preserved instead of being clobbered to literal 'None'.
        const extras = ['--raw'];
        if (args.stopped_at != null)  extras.push('--stopped-at',  String(args.stopped_at));
        if (args.resume_file != null) extras.push('--resume-file', String(args.resume_file));
        return runStateSubcommand('record-session', extras, 'Session recorded');
      }

      case 'gsd_commit_docs': {
        try {
          const files = args.files || [];
          const message = args.message || 'docs: update';
          if (files.length > 0) {
            execFileSync('git', ['add', '--', ...files], { stdio: 'pipe' });
          }
          execFileSync('git', ['commit', '-m', message], { stdio: 'pipe' });
          return { content: [{ type: 'text', text: `Committed: ${message}` }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Commit failed: ${err.message}` }], isError: true };
        }
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Tool error: ${err.message}` }], isError: true };
  }
}

// ─── MCP Protocol Handler ───────────────────────────────────────────────────

const SERVER_INFO = {
  name: 'gsd',
  version: '1.32.0'
};

const CAPABILITIES = {
  resources: { listChanged: false },
  tools: {}
};

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return sendResponse(id, {
        protocolVersion: '2024-11-05',
        serverInfo: SERVER_INFO,
        capabilities: CAPABILITIES
      });

    case 'notifications/initialized':
      // Client acknowledgement, no response needed
      return;

    case 'resources/list':
      return sendResponse(id, {
        resources: [
          { uri: 'gsd://state', name: 'GSD State', description: 'Current project state from STATE.md', mimeType: 'application/json' },
          { uri: 'gsd://roadmap', name: 'GSD Roadmap', description: 'Project roadmap from ROADMAP.md', mimeType: 'text/markdown' },
          { uri: 'gsd://requirements', name: 'GSD Requirements', description: 'Project requirements from REQUIREMENTS.md', mimeType: 'text/markdown' },
          { uri: 'gsd://config', name: 'GSD Config', description: 'Project config from .planning/config.json', mimeType: 'application/json' }
        ]
      });

    case 'resources/read': {
      const uri = params && params.uri;
      if (!uri) return sendError(id, -32602, 'Missing uri parameter');

      // Check static resources first
      if (resourceHandlers[uri]) {
        const result = resourceHandlers[uri]();
        if (result.error) return sendError(id, -32603, result.error);
        return sendResponse(id, result);
      }

      // Check parameterized phase resources
      const phaseMatch = uri.match(/^gsd:\/\/phase\/(\d+)$/);
      if (phaseMatch) {
        const result = handlePhaseResource(parseInt(phaseMatch[1]));
        if (result.error) return sendError(id, -32603, result.error);
        return sendResponse(id, result);
      }

      const contextMatch = uri.match(/^gsd:\/\/phase\/(\d+)\/context$/);
      if (contextMatch) {
        const result = handlePhaseContextResource(parseInt(contextMatch[1]));
        if (result.error) return sendError(id, -32603, result.error);
        return sendResponse(id, result);
      }

      return sendError(id, -32602, `Unknown resource URI: ${uri}`);
    }

    case 'tools/list':
      return sendResponse(id, { tools: toolDefinitions });

    case 'tools/call': {
      const toolName = params && params.name;
      const toolArgs = params && params.arguments || {};
      if (!toolName) return sendError(id, -32602, 'Missing tool name');
      const result = handleToolCall(toolName, toolArgs);
      return sendResponse(id, result);
    }

    default:
      return sendError(id, -32601, `Method not found: ${method}`);
  }
}

// ─── stdio transport ────────────────────────────────────────────────────────

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  requestBuffer += chunk;

  // Process complete messages. Prefer ndjson (current MCP spec); fall back to
  // LSP-style Content-Length framing only when a complete header block arrives
  // before the next newline, for legacy transports that still emit it. See #3.
  while (true) {
    const newlineIdx = requestBuffer.indexOf('\n');
    const lspHeaderEnd = requestBuffer.indexOf('\r\n\r\n');

    // ndjson path: a newline arrives before any LSP header block.
    if (newlineIdx !== -1 && (lspHeaderEnd === -1 || newlineIdx < lspHeaderEnd)) {
      const line = requestBuffer.substring(0, newlineIdx).trim();
      requestBuffer = requestBuffer.substring(newlineIdx + 1);
      if (!line) continue;
      if (line.startsWith('{')) {
        try {
          handleRequest(JSON.parse(line));
        } catch (err) {
          process.stderr.write(`GSD MCP: Failed to parse ndjson request: ${err.message}\n`);
        }
      }
      continue;
    }

    // LSP fallback: complete Content-Length header block present.
    if (lspHeaderEnd === -1) break;

    const header = requestBuffer.substring(0, lspHeaderEnd);
    const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) break;

    const contentLength = parseInt(contentLengthMatch[1]);
    const bodyStart = lspHeaderEnd + 4;
    const totalLength = bodyStart + contentLength;

    if (requestBuffer.length < totalLength) break;

    const body = requestBuffer.substring(bodyStart, totalLength);
    requestBuffer = requestBuffer.substring(totalLength);

    try {
      handleRequest(JSON.parse(body));
    } catch (err) {
      process.stderr.write(`GSD MCP: Failed to parse LSP-framed request: ${err.message}\n`);
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Signal readiness
process.stderr.write('GSD MCP server started (plugin-packaged)\n');
