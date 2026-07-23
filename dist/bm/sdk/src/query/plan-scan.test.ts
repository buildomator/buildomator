import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scanPhasePlans, countMatchedSummaries } from './plan-scan.js';

function summary(status: string): string {
  return `---\nphase: 40\nplan: 01\nstatus: ${status}\n---\n# Summary\n`;
}

describe('scanPhasePlans', () => {
  it('counts flat and nested plan files while excluding derivative files', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '1');
      const nestedDir = join(phaseDir, 'plans');
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(phaseDir, '01-01-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
      await writeFile(join(phaseDir, '01-01-PLAN-OUTLINE.md'), '# Outline');
      await writeFile(join(nestedDir, 'PLAN-02-next.md'), '# Plan');
      await writeFile(join(nestedDir, 'SUMMARY-02-next.md'), '# Summary');
      await writeFile(join(nestedDir, 'PLAN-03-draft.pre-bounce.md'), '# Draft');
      await writeFile(join(nestedDir, 'PLAN-04-OUTLINE.md'), '# Outline');

      expect(scanPhasePlans(phaseDir)).toMatchObject({
        planCount: 2,
        summaryCount: 2,
        completed: true,
        hasNestedPlans: true,
        planFiles: ['01-01-PLAN.md', 'PLAN-02-next.md'],
        summaryFiles: ['01-01-SUMMARY.md', 'SUMMARY-02-next.md'],
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('excludes a stray non-plan summary from summaryCount and completion', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '30');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '30-01-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '30-02-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '30-03-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '30-01-SUMMARY.md'), '# Summary');
      await writeFile(join(phaseDir, '30-02-SUMMARY.md'), '# Summary');
      await writeFile(join(phaseDir, '30-03-SUMMARY.md'), '# Summary');
      await writeFile(join(phaseDir, '30-FIX-CR02-SUMMARY.md'), '# Stray');
      await writeFile(join(phaseDir, '30-GAPCLOSURE-SUMMARY.md'), '# Stray');

      const scan = scanPhasePlans(phaseDir);
      expect(scan.planCount).toBe(3);
      expect(scan.summaryCount).toBe(3);
      expect(scan.completed).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not complete a phase when only a stray summary is present', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '31');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '31-01-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '31-GAPCLOSURE-SUMMARY.md'), '# Stray');

      const scan = scanPhasePlans(phaseDir);
      expect(scan.planCount).toBe(1);
      expect(scan.summaryCount).toBe(0);
      expect(scan.completed).toBe(false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('pairs bare PLAN.md with bare SUMMARY.md', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '5');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, 'PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, 'SUMMARY.md'), '# Summary');

      const scan = scanPhasePlans(phaseDir);
      expect(scan.summaryCount).toBe(1);
      expect(scan.completed).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('excludes a paused matched summary from summaryCount and completion', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '40');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '40-01-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '40-02-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '40-01-SUMMARY.md'), summary('paused'));
      await writeFile(join(phaseDir, '40-02-SUMMARY.md'), '# Summary');

      const scan = scanPhasePlans(phaseDir);
      expect(scan.planCount).toBe(2);
      expect(scan.summaryCount).toBe(1);
      expect(scan.completed).toBe(false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('excludes every incomplete status token', async () => {
    for (const st of ['partial', 'incomplete', 'blocked', 'gaps', 'gaps_found', 'not-complete', 'not_complete']) {
      const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
      try {
        const phaseDir = join(tmpDir, 'phases', '40');
        await mkdir(phaseDir, { recursive: true });
        await writeFile(join(phaseDir, '40-01-PLAN.md'), '# Plan');
        await writeFile(join(phaseDir, '40-02-PLAN.md'), '# Plan');
        await writeFile(join(phaseDir, '40-01-SUMMARY.md'), summary(st));
        await writeFile(join(phaseDir, '40-02-SUMMARY.md'), '# Summary');

        const scan = scanPhasePlans(phaseDir);
        expect(scan.summaryCount, `status ${st}`).toBe(1);
        expect(scan.completed, `status ${st}`).toBe(false);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    }
  });

  it('counts status-less and status: complete summaries and flips the phase complete', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '40');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '40-01-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '40-02-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '40-01-SUMMARY.md'), '# Summary');
      await writeFile(join(phaseDir, '40-02-SUMMARY.md'), summary('complete'));

      const scan = scanPhasePlans(phaseDir);
      expect(scan.summaryCount).toBe(2);
      expect(scan.completed).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('excludes an unreadable matched summary (treated as not complete)', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '40');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '40-01-PLAN.md'), '# Plan');
      // A directory in place of the summary file makes reading it as a file fail.
      await mkdir(join(phaseDir, '40-01-SUMMARY.md'));

      const scan = scanPhasePlans(phaseDir);
      expect(scan.summaryCount).toBe(0);
      expect(scan.completed).toBe(false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('excludes a nested stray SUMMARY that matches no nested plan', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '6');
      const nestedDir = join(phaseDir, 'plans');
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(nestedDir, 'PLAN-01-setup.md'), '# Plan');
      await writeFile(join(nestedDir, 'SUMMARY-01-setup.md'), '# Summary');
      await writeFile(join(nestedDir, 'SUMMARY-99-orphan.md'), '# Stray');

      const scan = scanPhasePlans(phaseDir);
      expect(scan.planCount).toBe(1);
      expect(scan.summaryCount).toBe(1);
      expect(scan.completed).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('countMatchedSummaries', () => {
  it('counts only summaries that pair with a plan id', () => {
    expect(countMatchedSummaries(
      ['30-01-PLAN.md', '30-02-PLAN.md'],
      ['30-01-SUMMARY.md', '30-02-SUMMARY.md', '30-FIX-CR02-SUMMARY.md'],
    )).toBe(2);
  });

  it('returns 0 when no summary pairs with a plan', () => {
    expect(countMatchedSummaries(['30-01-PLAN.md'], ['30-GAPCLOSURE-SUMMARY.md'])).toBe(0);
  });
});
