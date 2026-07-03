/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs line 1197-1206.
 */
export declare function replaceInCurrentMilestone(content: string, pattern: string | RegExp, replacement: string): string;
/**
 * Atomic read-modify-write for ROADMAP.md.
 *
 * Holds a lockfile across the entire read -> transform -> write cycle.
 */
export declare function readModifyWriteRoadmapMd(projectDir: string, modifier: (content: string) => string | Promise<string>, workstream?: string): Promise<string>;
//# sourceMappingURL=phase-roadmap-mutation.d.ts.map