import { GSDToolsError } from './gsd-tools-error.js';

export interface QueryFailureSignal {
  kind: 'timeout' | 'failure';
  message: string;
  timeoutMs?: number;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseTimeoutMs(message: string): number | undefined {
  const m = message.match(/timed out after\s+(\d+)ms/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

function isTimeoutMessage(message: string): boolean {
  return /timed out after/i.test(message);
}

export function timeoutMessage(command: string, args: string[], timeoutMs: number): string {
  return `gsd-tools timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`;
}

export function toFailureSignal(error: unknown): QueryFailureSignal {
  if (error instanceof GSDToolsError && error.classification) {
    return {
      kind: error.classification.kind,
      message: error.message,
      timeoutMs: error.classification.timeoutMs,
    };
  }

  const message = errorMessage(error);
  if (isTimeoutMessage(message)) {
    return { kind: 'timeout', message, timeoutMs: parseTimeoutMs(message) };
  }
  return { kind: 'failure', message };
}
