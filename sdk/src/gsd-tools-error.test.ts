import { describe, expect, it } from 'vitest';
import { GSDToolsError } from './gsd-tools-error.js';

describe('GSDToolsError constructors', () => {
  it('builds timeout-classified errors', () => {
    const err = GSDToolsError.timeout('timeout', 'state', ['load'], '', 1000);
    expect(err.classification).toEqual({ kind: 'timeout', timeoutMs: 1000 });
    expect(err.exitCode).toBeNull();
  });

  it('builds failure-classified errors', () => {
    const err = GSDToolsError.failure('boom', 'state', ['load'], 1);
    expect(err.classification).toEqual({ kind: 'failure' });
    expect(err.exitCode).toBe(1);
  });

  it('defaults direct constructor to failure classification', () => {
    const err = new GSDToolsError('boom', 'state', ['load'], 1, 'stderr');
    expect(err.classification).toEqual({ kind: 'failure' });
  });
});
