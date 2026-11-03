import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessTargetDoc,
  contentHash,
  reconcileCandidates,
  reconcilePending,
  reconcileRecord,
  reconcileSweep,
} from './reconcile.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'fixtures', 'reconcile');

let work: string;
function useFixture(name: string): string {
  const dir = join(work, name);
  cpSync(join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

type Described = {
  decisionHash: string;
  candidates: { file: string; autoRewritable: boolean; surfaceReason: string | null }[];
  ledgerOutcome: string | null;
  modelNeeded: boolean;
};
async function latest(dir: string): Promise<Described> {
  return (await reconcileCandidates(['--latest'], dir)).data as Described;
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'reconcile-'));
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('candidate retrieval', () => {
  it('enrolment-clear: one auto-rewritable plus one do-not-edit-block candidate', async () => {
    const r = await latest(useFixture('enrolment-clear'));
    expect(r.candidates).toHaveLength(2);
    expect(r.candidates.filter((c) => c.autoRewritable)).toHaveLength(1);
    const surface = r.candidates.filter((c) => !c.autoRewritable);
    expect(surface).toHaveLength(1);
    expect(surface[0].surfaceReason).toMatch(/auto-managed/);
    expect(r.modelNeeded).toBe(true);
  });

  it('ambiguous: one candidate', async () => {
    const r = await latest(useFixture('ambiguous'));
    expect(r.candidates).toHaveLength(1);
    expect(r.modelNeeded).toBe(true);
  });

  it('no-candidate: zero candidates and no model needed', async () => {
    const r = await latest(useFixture('no-candidate'));
    expect(r.candidates).toEqual([]);
    expect(r.modelNeeded).toBe(false);
  });
});

describe('ledger', () => {
  it('records an outcome, reports it afterwards, and is idempotent', async () => {
    const dir = useFixture('ambiguous');
    const before = await latest(dir);
    const rec = (await reconcileRecord([before.decisionHash, '--outcome', 'dismissed'], dir)).data as { changed: boolean };
    expect(rec.changed).toBe(true);
    const again = (await reconcileRecord([before.decisionHash, '--outcome', 'dismissed'], dir)).data as { changed: boolean };
    expect(again.changed).toBe(false);
    const after = await latest(dir);
    expect(after.ledgerOutcome).toBe('dismissed');
    expect(after.modelNeeded).toBe(false);
  });

  it('re-raises a decision whose text was edited (new hash)', async () => {
    const dir = useFixture('ambiguous');
    const before = await latest(dir);
    await reconcileRecord([before.decisionHash, '--outcome', 'reconciled-auto'], dir);
    const statePath = join(dir, 'STATE.md');
    writeFileSync(statePath, readFileSync(statePath, 'utf-8').replace('drafted automatically', 'drafted automatically nightly'));
    const edited = await latest(dir);
    expect(edited.decisionHash).not.toBe(before.decisionHash);
    expect(edited.ledgerOutcome).toBeNull();
    expect(edited.modelNeeded).toBe(true);
  });

  it('rejects an unknown outcome', async () => {
    const dir = useFixture('ambiguous');
    const r = (await reconcileRecord(['abc', '--outcome', 'nope'], dir)).data as { error?: string };
    expect(r.error).toBeDefined();
  });

  it('sweep lists only unrecorded decisions', async () => {
    const dir = useFixture('ambiguous');
    const first = (await reconcileSweep([], dir)).data as { count: number };
    expect(first.count).toBe(1);
    const d = await latest(dir);
    await reconcileRecord([d.decisionHash, '--outcome', 'dismissed'], dir);
    const second = (await reconcileSweep([], dir)).data as { count: number };
    expect(second.count).toBe(0);
  });

  it('hashes the same normalized text identically regardless of punctuation', () => {
    expect(contentHash('Use  sqlite, please!')).toBe(contentHash('use sqlite please'));
  });
});

describe('pending record', () => {
  it('merges without dropping an earlier undrained entry, and record drains by hash', async () => {
    const dir = useFixture('ambiguous');
    const pendingPath = join(dir, '.planning', 'reconcile-pending.json');
    const d = await latest(dir);
    writeFileSync(
      pendingPath,
      JSON.stringify({ version: 1, entries: { earlier: { decisionText: 'older', candidates: [] } } }),
    );
    await reconcilePending([d.decisionHash], dir);
    const merged = JSON.parse(readFileSync(pendingPath, 'utf-8')) as { entries: Record<string, unknown> };
    expect(Object.keys(merged.entries).sort()).toEqual([d.decisionHash, 'earlier'].sort());

    await reconcilePending([d.decisionHash], dir);
    const rewritten = JSON.parse(readFileSync(pendingPath, 'utf-8')) as { entries: Record<string, unknown> };
    expect(Object.keys(rewritten.entries)).toHaveLength(2);

    const rec = (await reconcileRecord([d.decisionHash, '--outcome', 'reconciled-asked'], dir)).data as { drainedPending: boolean };
    expect(rec.drainedPending).toBe(true);
    const drained = JSON.parse(readFileSync(pendingPath, 'utf-8')) as { entries: Record<string, unknown> };
    expect(Object.keys(drained.entries)).toEqual(['earlier']);
  });

  it('does not create a pending file when recording a hash that was never pending', async () => {
    const dir = useFixture('no-candidate');
    const d = await latest(dir);
    await reconcileRecord([d.decisionHash, '--outcome', 'dismissed'], dir);
    expect(existsSync(join(dir, '.planning', 'reconcile-pending.json'))).toBe(false);
  });
});

describe('assessTargetDoc safety gate', () => {
  const plain = '# Rules\n\n- Always ask first.\n';

  it('allows a plain repo-root CLAUDE.md rule', () => {
    expect(assessTargetDoc('CLAUDE.md', plain, 2).autoRewritable).toBe(true);
    expect(assessTargetDoc('./CLAUDE.md', plain, 2).autoRewritable).toBe(true);
  });

  it('allows a plain repo-root PROJECT.md rule', () => {
    expect(assessTargetDoc('PROJECT.md', plain, 2).autoRewritable).toBe(true);
  });

  it('blocks ROADMAP.md', () => {
    const v = assessTargetDoc('ROADMAP.md', plain, 2);
    expect(v.autoRewritable).toBe(false);
    expect(v.surfaceReason).toBeTruthy();
  });

  it('blocks STATE.md', () => {
    expect(assessTargetDoc('STATE.md', plain, 2).autoRewritable).toBe(false);
  });

  it('blocks the global ~/.claude/CLAUDE.md', () => {
    expect(assessTargetDoc(join(homedir(), '.claude', 'CLAUDE.md'), plain, 2, work).autoRewritable).toBe(false);
  });

  it('blocks an @-include line', () => {
    const v = assessTargetDoc('CLAUDE.md', '# Rules\n\n@docs/rules.md\n', 2);
    expect(v.autoRewritable).toBe(false);
    expect(v.surfaceReason).toMatch(/include/);
  });

  it('blocks a rule inside an auto-managed do-not-edit block', () => {
    const doc = '# Rules\n\n## Profile\n\n> managed by x -- do not edit manually.\n\n- Always ask first.\n';
    expect(assessTargetDoc('CLAUDE.md', doc, 6).autoRewritable).toBe(false);
  });
});
