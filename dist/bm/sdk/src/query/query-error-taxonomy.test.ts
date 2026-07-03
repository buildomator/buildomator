import { describe, it, expect } from 'vitest';
import {
  fallbackDispatchErrorFromSignal,
  fallbackFailureError,
  internalError,
  nativeDispatchErrorFromSignal,
  nativeFailureError,
  nativeTimeoutError,
  unknownCommandError,
  validationError,
} from './query-error-taxonomy.js';

describe('query-error-taxonomy', () => {
  it('builds unknown_command error', () => {
    const err = unknownCommandError({
      message: 'Error: Unknown command: "x"',
      normalized: 'x',
      attempted: ['x'],
      hints: ['h1'],
    });
    expect(err.kind).toBe('unknown_command');
    expect(err.code).toBe(10);
    expect(err.details).toMatchObject({ normalized: 'x', attempted: ['x'], hints: ['h1'] });
  });

  it('builds native/fallback/validation/internal errors', () => {
    expect(nativeFailureError({ message: 'boom', command: 'state.load', args: [] }).kind).toBe('native_failure');
    expect(nativeTimeoutError({ message: 'timeout', command: 'state.load', args: [], timeoutMs: 30000 }).kind).toBe('native_timeout');
    expect(fallbackFailureError({ message: 'spawn', command: 'state', args: ['load'] }).kind).toBe('fallback_failure');
    expect(validationError({ message: 'bad', details: { r: 'x' } }).kind).toBe('validation_error');
    expect(internalError({ message: 'bad' }).kind).toBe('internal_error');
  });

  it('projects dispatch errors from failure signals', () => {
    expect(nativeDispatchErrorFromSignal({ kind: 'failure', message: 'boom' }, 'state.load', []).kind).toBe('native_failure');
    expect(nativeDispatchErrorFromSignal({ kind: 'timeout', message: 'timeout', timeoutMs: 1000 }, 'state.load', []).kind).toBe('native_timeout');
    expect(fallbackDispatchErrorFromSignal({ kind: 'failure', message: 'spawn' }, 'state', ['load']).kind).toBe('fallback_failure');
  });
});
