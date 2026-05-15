/**
 * Workstream Inventory Module.
 *
 * Owns discovery and read-only projection of .planning/workstreams/* state.
 * Query handlers should render outputs from this inventory instead of
 * rescanning workstream directories directly.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toPosixPath } from './helpers.js';
import { scanPhasePlans } from './plan-scan.js';
import { stateExtractField } from './state-document.js';
import { readActiveWorkstream } from './active-workstream-store.js';
export const planningRoot = (projectDir) => join(projectDir, '.planning');
export const workstreamsRoot = (projectDir) => join(planningRoot(projectDir), 'workstreams');
function wsPlanningPaths(projectDir, name) {
    const base = join(planningRoot(projectDir), 'workstreams', name);
    return {
        state: join(base, 'STATE.md'),
        roadmap: join(base, 'ROADMAP.md'),
        phases: join(base, 'phases'),
        requirements: join(base, 'REQUIREMENTS.md'),
    };
}
function readSubdirectories(dir) {
    if (!existsSync(dir))
        return [];
    return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
}
export function countRoadmapPhases(roadmapPath, fallbackCount) {
    try {
        const roadmapContent = readFileSync(roadmapPath, 'utf-8');
        const matches = roadmapContent.match(/^#{2,4}\s+Phase\s+[\w][\w.-]*/gm);
        return matches ? matches.length : fallbackCount;
    }
    catch {
        return fallbackCount;
    }
}
export function countPhaseFiles(phaseDir) {
    const scan = scanPhasePlans(phaseDir);
    return { planCount: scan.planCount, summaryCount: scan.summaryCount };
}
function readStateProjection(statePath) {
    try {
        const stateContent = readFileSync(statePath, 'utf-8');
        return {
            status: stateExtractField(stateContent, 'Status') || 'unknown',
            current_phase: stateExtractField(stateContent, 'Current Phase'),
            last_activity: stateExtractField(stateContent, 'Last Activity'),
        };
    }
    catch {
        return {
            status: 'unknown',
            current_phase: null,
            last_activity: null,
        };
    }
}
export function inspectWorkstream(projectDir, name, options = {}) {
    const wsDir = join(workstreamsRoot(projectDir), name);
    if (!existsSync(wsDir))
        return null;
    const active = options.active === undefined ? readActiveWorkstream(projectDir) : options.active;
    const p = wsPlanningPaths(projectDir, name);
    const phaseDirs = readSubdirectories(p.phases);
    const phases = [];
    let completedPhases = 0;
    let totalPlans = 0;
    let completedPlans = 0;
    for (const dir of [...phaseDirs].sort()) {
        const counts = countPhaseFiles(join(p.phases, dir));
        const status = counts.summaryCount >= counts.planCount && counts.planCount > 0
            ? 'complete'
            : counts.planCount > 0
                ? 'in_progress'
                : 'pending';
        totalPlans += counts.planCount;
        completedPlans += Math.min(counts.summaryCount, counts.planCount);
        if (status === 'complete')
            completedPhases++;
        phases.push({
            directory: dir,
            status,
            plan_count: counts.planCount,
            summary_count: counts.summaryCount,
        });
    }
    const roadmapPhaseCount = countRoadmapPhases(p.roadmap, phaseDirs.length);
    const state = readStateProjection(p.state);
    return {
        name,
        path: toPosixPath(relative(projectDir, wsDir)),
        active: name === active,
        files: {
            roadmap: existsSync(p.roadmap),
            state: existsSync(p.state),
            requirements: existsSync(p.requirements),
        },
        status: state.status,
        current_phase: state.current_phase,
        last_activity: state.last_activity,
        phases,
        phase_count: phases.length,
        completed_phases: completedPhases,
        roadmap_phase_count: roadmapPhaseCount,
        total_plans: totalPlans,
        completed_plans: completedPlans,
        progress_percent: roadmapPhaseCount > 0 ? Math.min(100, Math.round((completedPhases / roadmapPhaseCount) * 100)) : 0,
    };
}
export function listWorkstreamInventories(projectDir) {
    const wsRoot = workstreamsRoot(projectDir);
    if (!existsSync(wsRoot)) {
        return {
            mode: 'flat',
            active: null,
            workstreams: [],
            count: 0,
            message: 'No workstreams — operating in flat mode',
        };
    }
    const active = readActiveWorkstream(projectDir);
    const entries = readdirSync(wsRoot, { withFileTypes: true });
    const workstreams = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const inventory = inspectWorkstream(projectDir, entry.name, { active });
        if (inventory)
            workstreams.push(inventory);
    }
    return {
        mode: 'workstream',
        active,
        workstreams,
        count: workstreams.length,
    };
}
//# sourceMappingURL=workstream-inventory.js.map