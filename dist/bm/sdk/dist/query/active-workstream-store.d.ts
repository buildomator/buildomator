/**
 * Read active workstream pointer from `.planning/active-workstream`.
 * Invalid or stale pointers are self-healed by clearing the file.
 */
export declare function readActiveWorkstream(projectDir: string): string | null;
export declare function writeActiveWorkstream(projectDir: string, name: string | null): void;
//# sourceMappingURL=active-workstream-store.d.ts.map