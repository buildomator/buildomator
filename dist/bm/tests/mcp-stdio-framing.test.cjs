#!/usr/bin/env node
/**
 * Regression test for issue #3:
 * mcp/server.cjs must speak newline-delimited JSON over stdio (not LSP-style
 * Content-Length framing). If this test fails, claude mcp list will report
 * "bm: ✗ Failed to connect" and the gsd_* MCP tools become unreachable.
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'mcp', 'server.cjs');
const TIMEOUT_MS = 5000;

function run() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`server did not respond within ${TIMEOUT_MS}ms (stdout=${stdout.length}B, stderr=${stderr.trim()})`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (b) => { stdout += b.toString('utf8'); });
    child.stderr.on('data', (b) => { stderr += b.toString('utf8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-framing-regression', version: '1.0' },
      },
    };
    const toolsList = { jsonrpc: '2.0', id: 2, method: 'tools/list' };

    child.stdin.write(JSON.stringify(initialize) + '\n');
    child.stdin.write(JSON.stringify(toolsList) + '\n');

    setTimeout(() => {
      child.stdin.end();
      setTimeout(() => child.kill('SIGTERM'), 200);
    }, 800);
  });
}

(async () => {
  let res;
  try {
    res = await run();
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  }

  const lines = res.stdout.split('\n').filter((l) => l.trim().startsWith('{'));
  if (lines.length < 2) {
    console.error(`FAIL: expected at least 2 ndjson responses, got ${lines.length}`);
    console.error(`stdout: ${JSON.stringify(res.stdout)}`);
    console.error(`stderr: ${res.stderr}`);
    process.exit(1);
  }

  let initResp, listResp;
  try {
    initResp = JSON.parse(lines[0]);
    listResp = JSON.parse(lines[1]);
  } catch (err) {
    console.error(`FAIL: response is not valid JSON: ${err.message}`);
    console.error(`line 1: ${lines[0]}`);
    console.error(`line 2: ${lines[1]}`);
    process.exit(1);
  }

  const checks = [
    [initResp.jsonrpc === '2.0', `initialize.jsonrpc !== '2.0' (got ${initResp.jsonrpc})`],
    [initResp.id === 1, `initialize.id !== 1 (got ${initResp.id})`],
    [!!initResp.result, `initialize has no result field`],
    [!!(initResp.result && initResp.result.protocolVersion), `initialize.result.protocolVersion missing`],
    [listResp.jsonrpc === '2.0', `tools/list.jsonrpc !== '2.0'`],
    [listResp.id === 2, `tools/list.id !== 2 (got ${listResp.id})`],
    [Array.isArray(listResp.result && listResp.result.tools), `tools/list.result.tools is not an array`],
    [listResp.result && listResp.result.tools.length > 0, `tools/list returned 0 tools`],
  ];

  let failed = false;
  for (const [ok, msg] of checks) {
    if (!ok) {
      console.error(`FAIL: ${msg}`);
      failed = true;
    }
  }

  if (failed) {
    console.error(`stdout: ${JSON.stringify(res.stdout)}`);
    process.exit(1);
  }

  // Defensive: stdout must NOT contain LSP Content-Length framing.
  if (/Content-Length:\s*\d+/i.test(res.stdout)) {
    console.error(`FAIL: stdout contains Content-Length: header — server regressed to LSP framing`);
    console.error(`stdout: ${JSON.stringify(res.stdout)}`);
    process.exit(1);
  }

  console.log(`PASS: initialize + tools/list both returned valid ndjson responses (${listResp.result.tools.length} tools).`);
  process.exit(0);
})();
