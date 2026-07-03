/**
 * STATE.md Document Module.
 *
 * Pure transforms for STATE.md text. This module does not read the filesystem
 * and does not own persistence or locking.
 */
export declare function stateExtractField(content: string, fieldName: string): string | null;
export declare function stateReplaceField(content: string, fieldName: string, newValue: string): string | null;
export declare function stateReplaceFieldWithFallback(content: string, primary: string, fallback: string | null, value: string): string;
/**
 * Known template default values that the SDK state handlers historically write.
 *
 * When a state handler is about to overwrite a "soft" field (Status, Last Activity,
 * Resume File, etc.) it consults this set. If the current value matches a template
 * default, the handler proceeds (it's overwriting its own past output). If the
 * current value is NOT a template default, the handler treats it as executor-authored
 * content and PRESERVES it.
 *
 * This preservation contract was added in plugin v2.45.0 (issue #9) after a real
 * data-loss-shape bug where state.advance-plan / state.record-session unconditionally
 * overwrote rich executor-authored Status / Last Activity / Resume File content with
 * template defaults, silently losing the executor's work.
 */
export declare const KNOWN_TEMPLATE_DEFAULTS: ReadonlySet<string>;
/**
 * Returns true if `value` is a known template default (handler-owned) OR a bare
 * ISO date (which the handlers also write as a default Last Activity value).
 * Returns false if `value` looks executor-authored.
 */
export declare function isStateTemplateDefault(value: string | null | undefined): boolean;
/**
 * Replace a field's value ONLY IF the current value is a known template default
 * (per `isStateTemplateDefault`). Preserves executor-authored content untouched.
 *
 * Returns:
 * - Updated content if the replace happened (current was template-default)
 * - Original content (unchanged) if the field exists but the current value is
 *   executor-authored (non-template). Logs a hint via the returned `preserved` flag.
 * - `null` if the field is not present in the content at all.
 *
 * Use this in state handlers that previously called `stateReplaceField` or
 * `stateReplaceFieldWithFallback` for "soft" fields. Hard fields the handler
 * legitimately owns (frontmatter `percent`, structural progress lines, the
 * "Plan: N of M" summary, etc.) can continue using the unconditional helpers.
 */
export declare function stateReplaceFieldIfTemplate(content: string, fieldName: string, newValue: string): {
    content: string;
    outcome: 'replaced' | 'preserved' | 'not_found';
};
/**
 * Like `stateReplaceFieldIfTemplate` but tries a primary field name and a
 * fallback (e.g., "Last Activity" then "Last activity"). Returns the first
 * outcome that wasn't `not_found`. If both are not_found, returns not_found.
 */
export declare function stateReplaceFieldIfTemplateWithFallback(content: string, primary: string, fallback: string | null, newValue: string): {
    content: string;
    outcome: 'replaced' | 'preserved' | 'not_found';
};
export declare function normalizeStateStatus(status: string | null | undefined, pausedAt?: string | null): string;
export declare function computeProgressPercent(completedPlans: number | null, totalPlans: number | null, completedPhases: number | null, totalPhases: number | null): number | null;
export declare function shouldPreserveExistingProgress(existingProgress: unknown, derivedProgress: unknown): existingProgress is Record<string, unknown>;
export declare function normalizeProgressNumbers(progress: unknown): unknown;
//# sourceMappingURL=state-document.d.ts.map