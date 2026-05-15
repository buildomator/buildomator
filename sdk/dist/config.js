/**
 * Config reader — loads `.planning/config.json` and merges with defaults.
 *
 * Mirrors the default structure from `get-shit-done/bin/lib/config.cjs`
 * `buildNewProjectConfig()`.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { relPlanningPath } from './workstream-utils.js';
// ─── Defaults ────────────────────────────────────────────────────────────────
export const CONFIG_DEFAULTS = {
    model_profile: 'balanced',
    commit_docs: true,
    parallelization: true,
    search_gitignored: false,
    brave_search: false,
    firecrawl: false,
    exa_search: false,
    git: {
        branching_strategy: 'none',
        phase_branch_template: 'gsd/phase-{phase}-{slug}',
        milestone_branch_template: 'gsd/{milestone}-{slug}',
        quick_branch_template: null,
    },
    workflow: {
        research: true,
        plan_check: true,
        verifier: true,
        nyquist_validation: true,
        tdd_mode: false,
        human_verify_mode: 'end-of-phase',
        auto_advance: false,
        node_repair: true,
        node_repair_budget: 2,
        ui_phase: true,
        ui_safety_gate: true,
        text_mode: false,
        research_before_questions: false,
        discuss_mode: 'discuss',
        skip_discuss: false,
        max_discuss_passes: 3,
        subagent_timeout: 300000,
        context_coverage_gate: true,
        _auto_chain_active: false,
    },
    hooks: {
        context_warnings: true,
    },
    agent_skills: {},
    project_code: null,
    mode: 'interactive',
};
// ─── Loader ──────────────────────────────────────────────────────────────────
/**
 * Load project config from `.planning/config.json`, merging with defaults.
 * When project config is missing or empty, this returns `mergeDefaults({})`
 * (built-in defaults only; no `~/.gsd/defaults.json` layering).
 * Throws on malformed JSON with a helpful error message.
 */
export async function loadConfig(projectDir, workstream) {
    const configPath = join(projectDir, relPlanningPath(workstream), 'config.json');
    const rootConfigPath = join(projectDir, '.planning', 'config.json');
    let raw;
    let projectConfigFound = false;
    try {
        raw = await readFile(configPath, 'utf-8');
        projectConfigFound = true;
    }
    catch {
        // If workstream config missing, fall back to root config
        if (workstream) {
            try {
                raw = await readFile(rootConfigPath, 'utf-8');
                projectConfigFound = true;
            }
            catch {
                raw = '';
            }
        }
        else {
            raw = '';
        }
    }
    // Pre-project context: no .planning/config.json exists.
    // Use built-in defaults only so SDK query parity stays stable across machines.
    if (!projectConfigFound) {
        return mergeDefaults({});
    }
    const trimmed = raw.trim();
    if (trimmed === '') {
        // Empty project config — treat as no project config.
        return mergeDefaults({});
    }
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse config at ${configPath}: ${msg}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Config at ${configPath} must be a JSON object`);
    }
    // Project config exists — user-level defaults are ignored (CJS parity).
    // `buildNewProjectConfig` already baked them into config.json at /gsd-new-project.
    return mergeDefaults(parsed);
}
function mergeDefaults(parsed) {
    const legacyBranchingStrategy = typeof parsed.branching_strategy === 'string'
        ? parsed.branching_strategy
        : undefined;
    return {
        ...structuredClone(CONFIG_DEFAULTS),
        ...parsed,
        git: {
            ...CONFIG_DEFAULTS.git,
            ...(legacyBranchingStrategy ? { branching_strategy: legacyBranchingStrategy } : {}),
            ...(parsed.git ?? {}),
        },
        workflow: {
            ...CONFIG_DEFAULTS.workflow,
            ...(parsed.workflow ?? {}),
        },
        hooks: {
            ...CONFIG_DEFAULTS.hooks,
            ...(parsed.hooks ?? {}),
        },
        agent_skills: {
            ...CONFIG_DEFAULTS.agent_skills,
            ...(parsed.agent_skills ?? {}),
        },
    };
}
//# sourceMappingURL=config.js.map