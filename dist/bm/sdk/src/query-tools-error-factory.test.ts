import { describe, expect, it } from 'vitest';
import { ErrorClassification, GSDError } from './errors.js';
import {
  createQueryNativeErrorFactory,
  createQueryToolsErrorFactory,
  toToolsErrorFromUnknown,
} from './query-tools-error-factory.js';

describe('query tools error factory', () => {
  it('builds timeout and failure tools errors via seam factories', () => {
    const toolsFactory = createQueryToolsErrorFactory();
    expect(toolsFactory.createTimeoutError('t', 'state', ['load'], '', 10).classification).toEqual({ kind: 'timeout', timeoutMs: 10 });
    expect(toolsFactory.createFailureError('f', 'state', ['load'], 1, '').classification).toEqual({ kind: 'failure' });
  });
  it('maps GSDError to failure with semantic exit code', () => {
    const err = toToolsErrorFromUnknown('state', ['load'], new GSDError('bad', ErrorClassification.Validation));
    expect(err.exitCode).toBe(10);
    expect(err.classification).toEqual({ kind: 'failure' });
  });

  it('maps timeout-like unknown errors to timeout classification', () => {
    const err = toToolsErrorFromUnknown('state', ['load'], new Error('gsd-tools timed out after 50ms: state load'));
    expect(err.classification).toEqual({ kind: 'timeout', timeoutMs: 50 });
  });

  it('builds subprocess/native error factories', () => {
    const toolsFactory = createQueryToolsErrorFactory();
    const nativeFactory = createQueryNativeErrorFactory(777);

    expect(toolsFactory.createFailureError('x', 'state', ['load'], 1, '').classification).toEqual({ kind: 'failure' });
    expect(toolsFactory.createTimeoutError('x', 'state', ['load'], '', 123).classification).toEqual({ kind: 'timeout', timeoutMs: 123 });
    expect(nativeFactory.createNativeTimeoutError('x', 'state', ['load']).classification).toEqual({ kind: 'timeout', timeoutMs: 777 });
    expect(nativeFactory.createNativeFailureError('x', 'state', ['load'], new Error('boom')).classification).toEqual({ kind: 'failure' });
  });
});
