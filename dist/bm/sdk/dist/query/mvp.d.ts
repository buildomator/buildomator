/**
 * MVP-mode query handlers — three centralized seams for the MVP umbrella feature (#2826).
 *
 * Replaces three architectural duplications surfaced by the v1.50.0-canary.2 review:
 *
 * 1. **`phase.mvp-mode`** — resolves the precedence chain
 *    `--mvp` CLI flag → ROADMAP `**Mode:** mvp` → `workflow.mvp_mode` config → false.
 *    Replaces near-identical bash blocks in `plan-phase.md`, `execute-phase.md`,
 *    `verify-work.md`, `progress.md`. Single canonical resolution; workflows just
 *    call the verb and read the boolean.
 *
 * 2. **`task.is-behavior-adding`** — applies the three-check predicate
 *    (tdd=true frontmatter AND `<behavior>` block AND non-test source files in `<files>`)
 *    that was previously prose-only in `references/execute-mvp-tdd.md`. The gsd-executor
 *    agent now invokes the verb instead of inlining the checks.
 *
 * 3. **`user-story.validate`** — applies the canonical user-story regex
 *    `/^As a .+, I want to .+, so that .+\.$/` previously hardcoded in `verify-work.md`
 *    prose. Consumed by the verifier (phase-goal guard) and by `/gsd-mvp-phase`
 *    (interactive-prompt validation).
 *
 * Domain terms: see CONTEXT.md → MVP Mode, User Story, Behavior-Adding Task.
 * Concept index: get-shit-done/references/mvp-concepts.md.
 */
import type { QueryHandler } from './utils.js';
export type MvpModeSource = 'cli_flag' | 'roadmap' | 'config' | 'none';
interface MvpModeResult {
    /** True when MVP mode applies to the phase. */
    active: boolean;
    /** Which signal in the precedence chain decided the result. */
    source: MvpModeSource;
    /** The literal value seen in ROADMAP.md `**Mode:**` (lowercased), or null when the field is absent. */
    roadmap_mode: string | null;
    /** The `workflow.mvp_mode` config value seen at resolution time. */
    config_mvp_mode: boolean;
    /** True when the caller indicated the `--mvp` CLI flag was present. */
    cli_flag_present: boolean;
}
/**
 * Resolve MVP mode for a phase. Precedence (first hit wins):
 *   1. `--cli-flag` arg on this verb (caller asserts the user passed `--mvp`)
 *   2. ROADMAP.md `**Mode:** mvp` for the phase
 *   3. `workflow.mvp_mode` config (project-wide default)
 *   4. false
 *
 * @example
 *   gsd-sdk query phase.mvp-mode 1                    # roadmap + config check
 *   gsd-sdk query phase.mvp-mode 1 --cli-flag         # caller saw --mvp on CLI
 */
export declare const phaseMvpMode: QueryHandler<MvpModeResult>;
interface BehaviorAddingResult {
    /** True when ALL three predicate checks pass. */
    is_behavior_adding: boolean;
    /** Per-check breakdown — useful for halt-and-report messages. */
    checks: {
        tdd_true: boolean;
        has_behavior_block: boolean;
        has_source_files: boolean;
    };
    /** Human-readable reason when `is_behavior_adding` is false. */
    reason: string | null;
}
/**
 * Predicate: does this PLAN.md task add user-visible behavior under MVP+TDD?
 *
 * Three checks, all required:
 *   (1) `tdd="true"` frontmatter
 *   (2) `<behavior>` block names a user-visible outcome (block exists and is non-empty)
 *   (3) `<files>` includes at least one non-test source file
 *       (excludes `*.md`, `*.json`, `*.test.*`, `*.spec.*`)
 *
 * Pure doc-only / config-only / test-only tasks return `is_behavior_adding=false`
 * and are exempt from the MVP+TDD Gate.
 *
 * Canonical specification: get-shit-done/references/execute-mvp-tdd.md.
 *
 * @example
 *   gsd-sdk query task.is-behavior-adding ./plans/01-PLAN-auth.md
 *   gsd-sdk query task.is-behavior-adding --task-content "<task>...</task>"
 */
export declare const taskIsBehaviorAdding: QueryHandler<BehaviorAddingResult>;
interface UserStoryValidateResult {
    /** True when the input matches the canonical user-story regex. */
    valid: boolean;
    /** The literal input string echoed back. */
    input: string;
    /** Per-slot extraction when `valid` is true; null when invalid. */
    slots: {
        role: string;
        capability: string;
        outcome: string;
    } | null;
    /** Specific guidance when `valid` is false. */
    errors: string[];
}
/**
 * The canonical User Story regex — exported so unit tests can assert it directly
 * and other modules can import it without re-defining.
 *
 * Pattern: `As a [role], I want to [capability], so that [outcome].`
 */
export declare const USER_STORY_REGEX: RegExp;
/**
 * Validate that a string matches the User Story format used by MVP-mode phases.
 * Used by `gsd-verifier` (phase-goal guard) and `/gsd-mvp-phase` (interactive prompting).
 *
 * @example
 *   gsd-sdk query user-story.validate "As a user, I want to log in, so that I can see my data."
 *   gsd-sdk query user-story.validate --story "<text>"
 */
export declare const userStoryValidate: QueryHandler<UserStoryValidateResult>;
export {};
//# sourceMappingURL=mvp.d.ts.map