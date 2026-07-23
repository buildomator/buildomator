import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractFrontmatter } from './frontmatter.js';

const PLAN_OUTLINE_RE = /-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /\.pre-bounce\.md$/i;

// Summary statuses that mean a plan stopped short of completion (paused at a
// blocking checkpoint, left partial, blocked, or gaps-flagged). A summary
// carrying one of these does NOT credit its plan toward completion. Matched
// case-insensitively against the summary's frontmatter `status`.
export const INCOMPLETE_SUMMARY_STATUSES = new Set<string>([
  'paused', 'partial', 'incomplete', 'blocked',
  'gaps', 'gaps_found', 'not-complete', 'not_complete',
]);

// Whether a summary file at an absolute path counts its plan as complete. An
// unreadable/corrupt summary is treated as NOT complete (safety bias: never
// skip unbuilt work). A readable summary with no status field, status
// `complete`, or any other value counts as complete.
export function summaryFileIsComplete(summaryPath: string): boolean {
  let content: string;
  try {
    content = readFileSync(summaryPath, 'utf-8');
  } catch {
    return false;
  }
  const fm = extractFrontmatter(content);
  const status = String(fm.status ?? '').toLowerCase();
  return !INCOMPLETE_SUMMARY_STATUSES.has(status);
}

// Resolve a summary filename to its absolute path within a phase directory.
// Root-layout summaries live directly in the phase dir; nested-layout summaries
// live in the plans/ subdir.
export function resolveSummaryPath(phaseDir: string, summaryFile: string): string {
  const rootPath = join(phaseDir, summaryFile);
  if (existsSync(rootPath)) return rootPath;
  return join(phaseDir, 'plans', summaryFile);
}

export interface PhasePlanScan {
  planCount: number;
  summaryCount: number;
  completed: boolean;
  hasNestedPlans: boolean;
  planFiles: string[];
  summaryFiles: string[];
}

export function isRootPlanFile(fileName: string): boolean {
  if (PLAN_OUTLINE_RE.test(fileName)) return false;
  if (PLAN_PRE_BOUNCE_RE.test(fileName)) return false;
  if (fileName.endsWith('-PLAN.md') || fileName === 'PLAN.md') return true;
  return /\.md$/i.test(fileName) && /PLAN/i.test(fileName);
}

export function isNestedPlanFile(fileName: string): boolean {
  if (PLAN_OUTLINE_RE.test(fileName)) return false;
  if (PLAN_PRE_BOUNCE_RE.test(fileName)) return false;
  return /^PLAN-\d+.*\.md$/i.test(fileName) || /-PLAN-\d+.*\.md$/i.test(fileName);
}

export function isRootSummaryFile(fileName: string): boolean {
  return fileName.endsWith('-SUMMARY.md') || fileName === 'SUMMARY.md';
}

export function isNestedSummaryFile(fileName: string): boolean {
  return /^SUMMARY-\d+.*\.md$/i.test(fileName) || /-SUMMARY-\d+.*\.md$/i.test(fileName);
}

/**
 * Reduce a plan or summary filename to a layout-agnostic pairing id.
 *
 * Strips the PLAN/SUMMARY marker in every position it can appear:
 *   flat suffix   01-01-PLAN.md / 01-01-SUMMARY.md   -> 01-01
 *   bare          PLAN.md / SUMMARY.md               -> (empty)
 *   nested prefix PLAN-01-setup.md / SUMMARY-01-...  -> 01-setup
 *   extended infix 5-PLAN-01-setup.md / 5-SUMMARY-.. -> 5-01-setup
 *
 * A plan and its summary reduce to the same id; an unrelated remediation
 * summary (e.g. 30-FIX-CR02-SUMMARY.md) reduces to an id no plan shares.
 */
function planSummaryBaseId(filename: string): string {
  let base = filename.replace(/\.md$/i, '');
  base = base.replace(/-?(PLAN|SUMMARY)$/i, '');
  base = base.replace(/^(PLAN|SUMMARY)-/i, '');
  base = base.replace(/-(PLAN|SUMMARY)-/i, '-');
  return base;
}

/**
 * Count only the summaries that pair with a real plan file.
 *
 * A summary counts toward completion when its pairing id matches some plan's
 * pairing id. Stray summaries that match no plan are excluded, so they can
 * never inflate a phase to complete.
 */
export function countMatchedSummaries(planFiles: string[], summaryFiles: string[]): number {
  const planIds = new Set(planFiles.map(planSummaryBaseId));
  let matched = 0;
  for (const summary of summaryFiles) {
    if (planIds.has(planSummaryBaseId(summary))) matched++;
  }
  return matched;
}

/**
 * Count summaries that pair with a real plan AND count as complete.
 *
 * Extends countMatchedSummaries with a status read: a matched summary whose
 * frontmatter status is in INCOMPLETE_SUMMARY_STATUSES (or that is unreadable)
 * is excluded, so a plan paused at a checkpoint is never counted done.
 */
export function countMatchedCompleteSummaries(
  planFiles: string[],
  summaryFiles: string[],
  phaseDir: string,
): number {
  const planIds = new Set(planFiles.map(planSummaryBaseId));
  let matched = 0;
  for (const summary of summaryFiles) {
    if (!planIds.has(planSummaryBaseId(summary))) continue;
    if (summaryFileIsComplete(resolveSummaryPath(phaseDir, summary))) matched++;
  }
  return matched;
}

export function scanPhasePlans(phaseDir: string): PhasePlanScan {
  let rootFiles: string[];
  try {
    rootFiles = readdirSync(phaseDir);
  } catch {
    return {
      planCount: 0,
      summaryCount: 0,
      completed: false,
      hasNestedPlans: false,
      planFiles: [],
      summaryFiles: [],
    };
  }

  const rootPlanFiles = rootFiles.filter(isRootPlanFile);
  const rootSummaryFiles = rootFiles.filter(isRootSummaryFile);

  let nestedPlanFiles: string[] = [];
  let nestedSummaryFiles: string[] = [];
  let hasNestedPlans = false;

  const nestedDir = join(phaseDir, 'plans');
  if (existsSync(nestedDir)) {
    try {
      const nestedFiles = readdirSync(nestedDir);
      nestedPlanFiles = nestedFiles.filter(isNestedPlanFile);
      nestedSummaryFiles = nestedFiles.filter(isNestedSummaryFile);
      hasNestedPlans = nestedPlanFiles.length > 0;
    } catch { /* ignore unreadable nested layout */ }
  }

  const planFiles = rootPlanFiles.concat(nestedPlanFiles);
  const summaryFiles = rootSummaryFiles.concat(nestedSummaryFiles);
  const planCount = planFiles.length;
  const summaryCount = countMatchedCompleteSummaries(planFiles, summaryFiles, phaseDir);

  return {
    planCount,
    summaryCount,
    completed: planCount > 0 && summaryCount >= planCount,
    hasNestedPlans,
    planFiles,
    summaryFiles,
  };
}
