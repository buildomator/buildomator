import { execFile } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { timeoutMessage } from './query-failure-classification.js';
import type { QueryToolsErrorFactory } from './query-tools-error-factory.js';

export interface QuerySubprocessAdapterDeps extends QueryToolsErrorFactory {
  projectDir: string;
  gsdToolsPath: string;
  timeoutMs: number;
  workstream?: string;
}

export class QuerySubprocessAdapter {
  constructor(private readonly deps: QuerySubprocessAdapterDeps) {}

  async execJson(command: string, args: string[]): Promise<unknown> {
    const fullArgs = this.commandArgs(command, args);

    return new Promise<unknown>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        fullArgs,
        {
          cwd: this.deps.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.deps.timeoutMs,
          env: { ...process.env },
        },
        async (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';

          if (error) {
            reject(this.processExecutionError(command, args, error, stderrStr));
            return;
          }

          const raw = stdout?.toString() ?? '';
          try {
            const parsed = await this.parseOutput(raw);
            resolve(parsed);
          } catch (parseErr) {
            reject(
              this.deps.createFailureError(
                `Failed to parse gsd-tools output for "${command}": ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw output: ${raw.slice(0, 500)}`,
                command,
                args,
                0,
                stderrStr,
              ),
            );
          }
        },
      );

      child.on('error', (err) => {
        reject(this.processSpawnError(command, args, err));
      });
    });
  }

  async execRaw(command: string, args: string[]): Promise<string> {
    const fullArgs = [...this.commandArgs(command, args), '--raw'];

    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        fullArgs,
        {
          cwd: this.deps.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.deps.timeoutMs,
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';
          if (error) {
            reject(this.processExecutionError(command, args, error, stderrStr));
            return;
          }
          resolve((stdout?.toString() ?? '').trim());
        },
      );

      child.on('error', (err) => {
        reject(this.processSpawnError(command, args, err));
      });
    });
  }

  private commandArgs(command: string, args: string[]): string[] {
    const wsArgs = this.deps.workstream ? ['--ws', this.deps.workstream] : [];
    return [this.deps.gsdToolsPath, command, ...args, ...wsArgs];
  }

  private processExecutionError(
    command: string,
    args: string[],
    error: Error & { code?: unknown; status?: number; killed?: boolean },
    stderrStr: string,
  ) {
    if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      return this.deps.createTimeoutError(
        timeoutMessage(command, args, this.deps.timeoutMs),
        command,
        args,
        stderrStr,
        this.deps.timeoutMs,
      );
    }

    return this.deps.createFailureError(
      `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
      command,
      args,
      typeof error.code === 'number' ? error.code : error.status ?? 1,
      stderrStr,
    );
  }

  private processSpawnError(command: string, args: string[], err: Error) {
    return this.deps.createFailureError(`Failed to execute gsd-tools: ${err.message}`, command, args, null, '');
  }

  private async parseOutput(raw: string): Promise<unknown> {
    const trimmed = raw.trim();

    if (trimmed === '') {
      return null;
    }

    let jsonStr = trimmed;
    if (jsonStr.startsWith('@file:')) {
      const filePath = jsonStr.slice(6).trim();
      const resolvedPath = isAbsolute(filePath) ? filePath : resolve(this.deps.projectDir, filePath);
      try {
        jsonStr = await readFile(resolvedPath, 'utf-8');
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to read gsd-tools @file: indirection at "${resolvedPath}": ${reason}`);
      }
    }

    return JSON.parse(jsonStr);
  }
}
