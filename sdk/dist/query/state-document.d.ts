/**
 * STATE.md Document Module.
 *
 * Pure transforms for STATE.md text. This module does not read the filesystem
 * and does not own persistence or locking.
 */
export declare function stateExtractField(content: string, fieldName: string): string | null;
export declare function stateReplaceField(content: string, fieldName: string, newValue: string): string | null;
export declare function stateReplaceFieldWithFallback(content: string, primary: string, fallback: string | null, value: string): string;
export declare function normalizeStateStatus(status: string | null | undefined, pausedAt?: string | null): string;
export declare function computeProgressPercent(completedPlans: number | null, totalPlans: number | null, completedPhases: number | null, totalPhases: number | null): number | null;
export declare function shouldPreserveExistingProgress(existingProgress: unknown, derivedProgress: unknown): existingProgress is Record<string, unknown>;
export declare function normalizeProgressNumbers(progress: unknown): unknown;
//# sourceMappingURL=state-document.d.ts.map