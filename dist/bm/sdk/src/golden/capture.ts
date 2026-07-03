/**
 * Golden test helpers — run `gsd-tools.cjs` as a subprocess and capture JSON or raw stdout.
 *
 * Used by `golden.integration.test.ts` and `read-only-parity.integration.test.ts` to assert
 * SDK `createRegistry()` output matches the legacy CJS CLI.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveGsdToolsPath } from '../gsd-tools.js';

const CAPTURE_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 10 * 1024 * 1024;

// Golden tests assert parity against THIS repo's CJS CLI. When CLAUDE_PLUGIN_ROOT
// is unset (the default under vitest), resolveGsdToolsPath() falls back to a
// legacy `~/.claude/get-shit-done/bin/gsd-tools.cjs` path that does not exist in
// the dev tree, so every golden test errors with MODULE_NOT_FOUND. Prefer the
// repo's own bin/gsd-tools.cjs (relative to this source file) so the suite is
// self-contained; defer to the real resolver when CLAUDE_PLUGIN_ROOT is set.
const REPO_GSD_TOOLS = fileURLToPath(new URL('../../../bin/gsd-tools.cjs', import.meta.url));

function resolveToolsForGolden(projectDir: string): string {
  if (!process.env.CLAUDE_PLUGIN_ROOT && existsSync(REPO_GSD_TOOLS)) return REPO_GSD_TOOLS;
  return resolveGsdToolsPath(projectDir);
}

function execGsdTools(
  projectDir: string,
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const script = resolveToolsForGolden(projectDir);
  const fullArgs = [script, command, ...args];
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      fullArgs,
      {
        cwd: projectDir,
        maxBuffer: MAX_BUFFER,
        timeout: CAPTURE_TIMEOUT_MS,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        if (err) {
          const code = typeof err === 'object' && err && 'code' in err ? String((err as NodeJS.ErrnoException).code) : '';
          const stderrStr = stderr?.toString() ?? '';
          reject(
            new Error(
              `gsd-tools failed (exit ${code}): ${stderrStr || (err instanceof Error ? err.message : String(err))}`,
            ),
          );
          return;
        }
        resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
      },
    );
  });
}

/** Same `@file:` indirection handling as {@link GSDTools} private parseOutput (cwd = projectDir). */
async function parseGsdToolsJson(raw: string, projectDir: string): Promise<unknown> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  let jsonStr = trimmed;
  if (jsonStr.startsWith('@file:')) {
    const rel = jsonStr.slice(6).trim();
    const filePath = isAbsolute(rel) ? rel : join(projectDir, rel);
    try {
      jsonStr = await readFile(filePath, 'utf-8');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read gsd-tools @file: indirection at "${filePath}": ${reason}`);
    }
  }

  return JSON.parse(jsonStr);
}

/**
 * Run `node gsd-tools.cjs <command> [...args]` in `projectDir` and parse stdout as JSON.
 */
export async function captureGsdToolsOutput(
  command: string,
  args: string[],
  projectDir: string,
): Promise<unknown> {
  const { stdout } = await execGsdTools(projectDir, command, args);
  return parseGsdToolsJson(stdout, projectDir);
}

/**
 * Run `node gsd-tools.cjs <command> [...args]` and return raw stdout (no JSON parse).
 */
export async function captureGsdToolsStdout(
  command: string,
  args: string[],
  projectDir: string,
): Promise<string> {
  const { stdout } = await execGsdTools(projectDir, command, args);
  return stdout;
}
