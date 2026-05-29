#!/usr/bin/env node
/**
 * End-to-end regression test for #11 (reported by @tinmanlab / Hyeonseok Seong).
 *
 * Drives mcp/server.cjs as a child process over stdio ndjson, calls each of
 * the 6 write tools that were broken by the state.cjs refactor (name drift +
 * calling-convention drift), and asserts none of them returns the misleading
 * "state module not available" error. Also asserts at least one tool
 * (gsd_add_blocker) actually mutates STATE.md on disk, proving the calling
 * convention is correct end-to-end.
 *
 * Without the v2.45.5 fix, all 6 calls would return isError=true with text
 * "state module not available" because server.cjs called state.cmdX (no State
 * infix) which resolved to undefined post-refactor.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SERVER = path.join(__dirname, '..', 'mcp', 'server.cjs');
// The MCP server's write-tool handlers do spawnSync internally (one node
// subprocess per call, see mcp/server.cjs runStateSubcommand). With 6
// sequential write-tool calls in one test case, the per-call cost adds up
// to ~600-1200ms. Generous timeouts keep CI deterministic; locally the
// test usually completes in well under half this budget.
const TIMEOUT_MS = 15000;
const POST_REQUEST_WAIT_MS = 5000;

// Minimal STATE.md fixture: cmdStateAddBlocker auto-creates the Blockers
// section if absent (DWIM scaffold path), so we just need a parseable file.
// cmdStateAdvancePlan needs a "Plan: X of Y" field to advance, so we include
// that too.
const FIXTURE_STATE_MD = `---
project: mcp-regression-test
---

# Test Project State

Status: Ready to execute
Plan: 1 of 3
Last activity: 2026-01-01
`;

async function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-mcp-write-test-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), FIXTURE_STATE_MD);
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function callMcp(cwd, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, {
        CLAUDE_PLUGIN_ROOT: path.resolve(__dirname, '..'),
      }),
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`MCP server did not respond within ${TIMEOUT_MS}ms (stdout=${stdout.length}B, stderr=${stderr.trim().slice(0, 400)})`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (b) => { stdout += b.toString('utf8'); });
    child.stderr.on('data', (b) => { stderr += b.toString('utf8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', () => {
      clearTimeout(timer);
      const lines = stdout.split('\n').filter(l => l.trim().length > 0);
      const responses = [];
      for (const line of lines) {
        try {
          responses.push(JSON.parse(line));
        } catch {
          // Non-JSON lines are notifications or noise; ignore.
        }
      }
      resolve({ responses, stderr });
    });

    // Send all requests then wait for the server to drain and respond.
    for (const req of requests) {
      child.stdin.write(JSON.stringify(req) + '\n');
    }
    // Give the server enough time to spawnSync each write-tool subprocess
    // (~100-200ms per call) before closing stdin. 5s budget comfortably
    // covers 6 sequential write-tool calls plus initialize.
    setTimeout(() => {
      child.stdin.end();
      setTimeout(() => child.kill('SIGTERM'), 500);
    }, POST_REQUEST_WAIT_MS);
  });
}

function findResponse(responses, id) {
  return responses.find(r => r && r.id === id);
}

function extractToolText(response) {
  if (!response || !response.result || !response.result.content) return '';
  const c = response.result.content[0];
  return c && c.text ? c.text : '';
}

function isError(response) {
  return response && response.result && response.result.isError === true;
}

const checks = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { checks.push([true, name]); })
    .catch(err => { checks.push([false, `${name}: ${err.message}`]); });
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const WRITE_TOOLS = [
  { name: 'gsd_advance_plan',    args: {} },
  { name: 'gsd_record_metric',   args: { phase: '1', plan: '1', duration: '10' } },
  { name: 'gsd_add_decision',    args: { phase: '1', summary: 'test decision' } },
  { name: 'gsd_add_blocker',     args: { text: 'regression test marker for #11' } },
  { name: 'gsd_resolve_blocker', args: { text: 'nonexistent blocker' } },
  { name: 'gsd_record_session',  args: { stopped_at: 'test stop' } },
];

(async () => {
  await check('all 6 write tools respond without "state module not available"', async () => {
    await withTempProject(async (cwd) => {
      const requests = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-write-regression', version: '1.0' } } },
      ];
      WRITE_TOOLS.forEach((tool, idx) => {
        requests.push({
          jsonrpc: '2.0',
          id: 2 + idx,
          method: 'tools/call',
          params: { name: tool.name, arguments: tool.args },
        });
      });

      const { responses, stderr } = await callMcp(cwd, requests);
      assert(responses.length > 0, `no responses received. stderr:\n${stderr}`);

      const failedTools = [];
      WRITE_TOOLS.forEach((tool, idx) => {
        const resp = findResponse(responses, 2 + idx);
        if (!resp) {
          failedTools.push(`${tool.name}: no response`);
          return;
        }
        const text = extractToolText(resp);
        if (isError(resp) && text === 'state module not available') {
          failedTools.push(`${tool.name}: "state module not available" (#11 regression!)`);
        }
        // Other error shapes (e.g. "STATE.md not found" if fixture mismatched)
        // are not the bug we are guarding against. The point of this assertion
        // is that the handler dispatched to a real function instead of failing
        // the undefined-export check.
      });

      assert(
        failedTools.length === 0,
        `${failedTools.length} write tool(s) still report the #11 regression:\n  ${failedTools.join('\n  ')}\n\nstderr:\n${stderr.slice(0, 400)}`
      );
    });
  });

  await check('gsd_add_blocker actually mutates STATE.md on disk', async () => {
    await withTempProject(async (cwd) => {
      const marker = `regression test marker ${Date.now()}`;
      const requests = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-write-regression', version: '1.0' } } },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'gsd_add_blocker', arguments: { text: marker } } },
      ];

      const { responses, stderr } = await callMcp(cwd, requests);
      const resp = findResponse(responses, 2);
      assert(resp, `no response for gsd_add_blocker. stderr:\n${stderr.slice(0, 400)}`);
      const text = extractToolText(resp);
      assert(
        text !== 'state module not available',
        `regression: gsd_add_blocker returned "state module not available"`
      );

      const stateMd = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
      assert(
        stateMd.includes(marker),
        `expected STATE.md to contain "${marker}" after gsd_add_blocker.\n` +
        `Got STATE.md content:\n---\n${stateMd}\n---\n` +
        `Tool response: ${text}\n` +
        `stderr: ${stderr.slice(0, 400)}`
      );
    });
  });

  await check('gsd_plan_status (read tool, control) still works', async () => {
    await withTempProject(async (cwd) => {
      const requests = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-write-regression', version: '1.0' } } },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'gsd_plan_status', arguments: {} } },
      ];
      const { responses } = await callMcp(cwd, requests);
      const resp = findResponse(responses, 2);
      assert(resp, 'no response for gsd_plan_status');
      const text = extractToolText(resp);
      assert(
        text.includes('Plan: 1 of 3'),
        `expected STATE.md content via read tool, got: ${text.slice(0, 200)}`
      );
    });
  });

  const failed = checks.filter(([ok]) => !ok);
  console.log('');
  console.log(`MCP write-tools end-to-end: ${checks.length - failed.length}/${checks.length} checks passed`);
  for (const [ok, name] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  process.exit(failed.length > 0 ? 1 : 0);
})();
