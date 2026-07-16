/**
 * Unit tests for scanQuickTasks classification in audit-open.ts.
 *
 * A quick task is flagged as open only when its SUMMARY is missing, unreadable,
 * or carries a status in the incomplete set. A readable SUMMARY with no status
 * field (or status complete) counts as done. Kept in lockstep with the CJS
 * scanner (tests/audit-open-quick-tasks.test.cjs) and the cross-boundary parity
 * assertion in golden/read-only-parity.integration.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { auditOpenArtifacts } from './audit-open.js';

let fixtureRoot: string;

function writeQuickDir(root: string, dirName: string, summaryName: string | null, body: string): void {
  const dir = join(root, '.planning', 'quick', dirName);
  mkdirSync(dir, { recursive: true });
  if (summaryName) writeFileSync(join(dir, summaryName), body);
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'gsd-audit-open-sdk-'));
  mkdirSync(join(fixtureRoot, '.planning', 'quick'), { recursive: true });

  // Case A: prefixed SUMMARY, phase but no status. The original bug shape.
  writeQuickDir(fixtureRoot, 'case-a-clean', 'case-a-clean-SUMMARY.md', '---\nphase: quick-x\n---\n\nDone.\n');
  // Case B: no SUMMARY file at all.
  writeQuickDir(fixtureRoot, 'case-b-no-summary', null, '');
  // Case C: prefixed SUMMARY, status incomplete.
  writeQuickDir(fixtureRoot, 'case-c-incomplete', 'case-c-incomplete-SUMMARY.md', '---\nstatus: incomplete\n---\n\nWIP.\n');
  // Case C uppercase variant: status BLOCKED.
  writeQuickDir(fixtureRoot, 'case-c-blocked', 'case-c-blocked-SUMMARY.md', '---\nstatus: BLOCKED\n---\n\nStuck.\n');
  // Case D: bare SUMMARY.md, no status field.
  writeQuickDir(fixtureRoot, 'case-d-bare', 'SUMMARY.md', '---\nphase: quick-y\n---\n\nDone.\n');
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function quickTasks(): Array<Record<string, unknown>> {
  const result = auditOpenArtifacts(fixtureRoot);
  return result.items.quick_tasks.filter(t => !t.scan_error);
}

function statusFor(slug: string): unknown {
  const hit = quickTasks().find(t => t.slug === slug);
  return hit ? hit.status : undefined;
}

describe('scanQuickTasks classification', () => {
  it('does not flag a prefixed SUMMARY with no status field (case A)', () => {
    const slugs = quickTasks().map(t => t.slug);
    expect(slugs).not.toContain('case-a-clean');
  });

  it('flags a dir with no SUMMARY as missing (case B)', () => {
    const slugs = quickTasks().map(t => t.slug);
    expect(slugs).toContain('case-b-no-summary');
    expect(statusFor('case-b-no-summary')).toBe('missing');
  });

  it('flags status incomplete (case C)', () => {
    const slugs = quickTasks().map(t => t.slug);
    expect(slugs).toContain('case-c-incomplete');
    expect(statusFor('case-c-incomplete')).toBe('incomplete');
  });

  it('flags uppercase status BLOCKED, lowercased to blocked (case C)', () => {
    const slugs = quickTasks().map(t => t.slug);
    expect(slugs).toContain('case-c-blocked');
    expect(statusFor('case-c-blocked')).toBe('blocked');
  });

  it('does not flag a bare SUMMARY.md with no status field (case D)', () => {
    const slugs = quickTasks().map(t => t.slug);
    expect(slugs).not.toContain('case-d-bare');
  });

  it('flags exactly cases B and both C variants', () => {
    const slugs = quickTasks().map(t => t.slug).sort();
    expect(slugs).toEqual(['case-b-no-summary', 'case-c-blocked', 'case-c-incomplete']);
  });
});
