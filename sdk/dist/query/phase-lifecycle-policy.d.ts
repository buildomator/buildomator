export interface PhaseDirectoryComputation {
    phaseId: number | string;
    dirName: string;
}
export interface NextDecimalPhaseResult {
    next: string;
    existing: string[];
}
/** Reject strings containing null bytes (path traversal defense). */
export declare function assertNoNullBytes(value: string, label: string): void;
/** Reject `..` or path separators in phase directory names. */
export declare function assertSafePhaseDirName(dirName: string, label?: string): void;
export declare function assertSafeProjectCode(code: string): void;
/** Generate kebab-case slug from description. */
export declare function generatePhaseSlug(text: string): string;
export declare function parseMultiwordArg(args: string[], flag: string): string | null;
export declare function extractOneLinerFromBody(content: string): string | null;
/**
 * Scan highest sequential phase number in milestone content.
 * Skips backlog lanes (`999.x`).
 */
export declare function scanSequentialMaxPhaseFromMilestone(milestoneContent: string): number;
/**
 * Scan highest sequential phase number from phase directory names.
 * Supports optional project-code prefix and optional decimal suffixes.
 */
export declare function scanSequentialMaxPhaseFromDirs(dirNames: string[]): number;
export declare function computeNextSequentialPhaseId(milestoneContent: string, dirNames: string[]): number;
export declare function computePhaseDirectory(namingMode: unknown, descriptionSlug: string, prefix: string, nextSequentialPhaseId: number, customId?: string | null): PhaseDirectoryComputation;
export declare function buildPhaseRoadmapEntry(phaseId: number | string, description: string, namingMode: unknown): string;
export declare function collectDecimalSuffixesFromDirNames(basePhase: string, dirNames: string[]): Set<number>;
export declare function collectDecimalSuffixesFromRoadmap(basePhase: string, roadmapContent: string): Set<number>;
export declare function computeNextDecimalPhase(basePhase: string, decimalSet: Set<number>): NextDecimalPhaseResult;
//# sourceMappingURL=phase-lifecycle-policy.d.ts.map