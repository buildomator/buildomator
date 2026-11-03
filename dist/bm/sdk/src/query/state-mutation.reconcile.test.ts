import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateAddDecision } from './state-mutation.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'fixtures', 'reconcile');

let work: string;
function useFixture(name: string): string {
  const dir = join(work, name);
  cpSync(join(FIXTURES, name), dir, { recursive: true });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  renameSync(join(dir, 'STATE.md'), join(dir, '.planning', 'STATE.md'));
  return dir;
}

type Result = { added: boolean; reconcile?: { candidates: unknown[]; decisionHash: string; directive: string } };

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'add-decision-'));
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('stateAddDecision reconcile directive', () => {
  it('omits the reconcile field for a fresh-topic decision', async () => {
    const dir = useFixture('no-candidate');
    const r = (await stateAddDecision(['--phase', '4', '--summary', 'Adopt quarterly telemetry dashboards'], dir)).data as Result;
    expect(r.added).toBe(true);
    expect(r.reconcile).toBeUndefined();
  });

  it('attaches a directive when a rule matches and the ledger is empty', async () => {
    const dir = useFixture('enrolment-clear');
    const r = (await stateAddDecision(['--phase', '4', '--summary', 'Cohort enrolment and invoicing need one approval ask only'], dir)).data as Result;
    expect(r.added).toBe(true);
    expect(r.reconcile).toBeDefined();
    expect(r.reconcile!.candidates.length).toBeGreaterThan(0);
    expect(r.reconcile!.decisionHash).toMatch(/^[0-9a-f]{16}$/);
    expect(r.reconcile!.directive).toContain('references/decision-reconciliation.md');
  });
});
