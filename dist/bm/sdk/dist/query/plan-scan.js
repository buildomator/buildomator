import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const PLAN_OUTLINE_RE = /-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /\.pre-bounce\.md$/i;
export function isRootPlanFile(fileName) {
    if (PLAN_OUTLINE_RE.test(fileName))
        return false;
    if (PLAN_PRE_BOUNCE_RE.test(fileName))
        return false;
    if (fileName.endsWith('-PLAN.md') || fileName === 'PLAN.md')
        return true;
    return /\.md$/i.test(fileName) && /PLAN/i.test(fileName);
}
export function isNestedPlanFile(fileName) {
    if (PLAN_OUTLINE_RE.test(fileName))
        return false;
    if (PLAN_PRE_BOUNCE_RE.test(fileName))
        return false;
    return /^PLAN-\d+.*\.md$/i.test(fileName) || /-PLAN-\d+.*\.md$/i.test(fileName);
}
export function isRootSummaryFile(fileName) {
    return fileName.endsWith('-SUMMARY.md') || fileName === 'SUMMARY.md';
}
export function isNestedSummaryFile(fileName) {
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
function planSummaryBaseId(filename) {
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
export function countMatchedSummaries(planFiles, summaryFiles) {
    const planIds = new Set(planFiles.map(planSummaryBaseId));
    let matched = 0;
    for (const summary of summaryFiles) {
        if (planIds.has(planSummaryBaseId(summary)))
            matched++;
    }
    return matched;
}
export function scanPhasePlans(phaseDir) {
    let rootFiles;
    try {
        rootFiles = readdirSync(phaseDir);
    }
    catch {
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
    let nestedPlanFiles = [];
    let nestedSummaryFiles = [];
    let hasNestedPlans = false;
    const nestedDir = join(phaseDir, 'plans');
    if (existsSync(nestedDir)) {
        try {
            const nestedFiles = readdirSync(nestedDir);
            nestedPlanFiles = nestedFiles.filter(isNestedPlanFile);
            nestedSummaryFiles = nestedFiles.filter(isNestedSummaryFile);
            hasNestedPlans = nestedPlanFiles.length > 0;
        }
        catch { /* ignore unreadable nested layout */ }
    }
    const planFiles = rootPlanFiles.concat(nestedPlanFiles);
    const summaryFiles = rootSummaryFiles.concat(nestedSummaryFiles);
    const planCount = planFiles.length;
    const summaryCount = countMatchedSummaries(planFiles, summaryFiles);
    return {
        planCount,
        summaryCount,
        completed: planCount > 0 && summaryCount >= planCount,
        hasNestedPlans,
        planFiles,
        summaryFiles,
    };
}
//# sourceMappingURL=plan-scan.js.map