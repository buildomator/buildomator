import { describe, it, expect } from 'vitest';
import { GSD } from './index.js';
import { GSDEventType, type GSDEvent } from './types.js';

describe('GSD runtime bridge options', () => {
  it('strictSdk option is honored by createTools dispatch seam', async () => {
    const gsd = new GSD({
      projectDir: process.cwd(),
      strictSdk: true,
      allowFallbackToSubprocess: true,
      sessionId: 'test-session',
    });

    const events: GSDEvent[] = [];
    gsd.onEvent((event) => events.push(event));

    await expect(gsd.createTools().exec('nonexistent-command', [])).rejects.toThrow(
      "Strict SDK mode: command 'nonexistent-command' has no native adapter",
    );

    const streamEvent = events.find((event) => event.type === GSDEventType.StreamEvent);
    expect(streamEvent).toBeDefined();
    expect(streamEvent).toMatchObject({
      type: GSDEventType.StreamEvent,
      sessionId: 'test-session',
      event: {
        type: 'query_dispatch',
        command: 'nonexistent-command',
        outcome: 'error',
      },
    });
  });
});
