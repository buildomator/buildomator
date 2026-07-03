import { describe, it, expect, vi } from 'vitest';
import { QueryRuntimeBridge } from './query-runtime-bridge.js';
import { GSDToolsError } from './gsd-tools-error.js';

describe('QueryRuntimeBridge observability', () => {
  it('emits query_dispatch success event with transport decision', async () => {
    const onDispatchEvent = vi.fn();
    const executionPolicy = {
      execute: vi.fn(async (request: { onTransportDecision?: (d: unknown) => void }) => {
        request.onTransportDecision?.({ dispatchMode: 'subprocess', reason: 'workstream_forced' });
        return { ok: true };
      }),
    };

    const bridge = new QueryRuntimeBridge(
      { has: () => true } as never,
      executionPolicy as never,
      { dispatch: vi.fn() } as never,
      () => true,
      { onDispatchEvent },
    );

    await bridge.execute({
      legacyCommand: 'state',
      legacyArgs: ['load'],
      registryCommand: 'state.load',
      registryArgs: [],
      mode: 'json',
      projectDir: '/tmp',
      workstream: 'ws-1',
    });

    expect(onDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query_dispatch',
        command: 'state.load',
        dispatchMode: 'subprocess',
        reason: 'workstream_forced',
        outcome: 'success',
      }),
    );
  });

  it('emits query_dispatch error event with errorKind', async () => {
    const onDispatchEvent = vi.fn();
    const executionPolicy = {
      execute: vi.fn(async () => {
        throw GSDToolsError.timeout('timeout', 'state', ['load'], '', 500);
      }),
    };

    const bridge = new QueryRuntimeBridge(
      { has: () => true } as never,
      executionPolicy as never,
      { dispatch: vi.fn() } as never,
      () => true,
      { onDispatchEvent },
    );

    await expect(
      bridge.execute({
        legacyCommand: 'state',
        legacyArgs: ['load'],
        registryCommand: 'state.load',
        registryArgs: [],
        mode: 'json',
        projectDir: '/tmp',
      }),
    ).rejects.toThrow();

    expect(onDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query_dispatch',
        command: 'state.load',
        outcome: 'error',
        errorKind: 'timeout',
      }),
    );
  });

  it('emits hotpath event', async () => {
    const onDispatchEvent = vi.fn();
    const bridge = new QueryRuntimeBridge(
      { has: () => true } as never,
      { execute: vi.fn() } as never,
      { dispatch: vi.fn(async () => 'ok') } as never,
      () => true,
      { onDispatchEvent },
    );

    await bridge.dispatchHotpath('commit', ['msg'], 'commit', ['msg'], 'raw');

    expect(onDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query_hotpath_dispatch',
        command: 'commit',
        dispatchMode: 'native_hotpath',
        outcome: 'success',
      }),
    );
  });

  it('emits subprocess hotpath event when native query is disabled', async () => {
    const onDispatchEvent = vi.fn();
    const bridge = new QueryRuntimeBridge(
      { has: () => true } as never,
      { execute: vi.fn() } as never,
      { dispatch: vi.fn(async () => 'ok') } as never,
      () => false,
      { onDispatchEvent, allowFallbackToSubprocess: true },
    );

    await bridge.dispatchHotpath('commit', ['msg'], 'commit', ['msg'], 'raw');

    expect(onDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query_hotpath_dispatch',
        command: 'commit',
        dispatchMode: 'subprocess',
        reason: 'native_disabled',
        outcome: 'success',
      }),
    );
  });

  it('blocks subprocess hotpath when fallback is disabled', async () => {
    const onDispatchEvent = vi.fn();
    const bridge = new QueryRuntimeBridge(
      { has: () => true } as never,
      { execute: vi.fn() } as never,
      { dispatch: vi.fn(async () => 'ok') } as never,
      () => false,
      { onDispatchEvent, allowFallbackToSubprocess: false },
    );

    await expect(
      bridge.dispatchHotpath('commit', ['msg'], 'commit', ['msg'], 'raw'),
    ).rejects.toThrow("Subprocess fallback disabled");

    expect(onDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query_hotpath_dispatch',
        command: 'commit',
        dispatchMode: 'subprocess',
        reason: 'policy_blocked',
        outcome: 'error',
      }),
    );
  });
});
