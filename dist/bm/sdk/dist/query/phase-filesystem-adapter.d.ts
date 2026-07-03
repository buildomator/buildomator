export declare function listDirectories(dirPath: string): Promise<string[]>;
export declare function ensureDirectoryWithGitkeep(dirPath: string): Promise<void>;
export declare function archiveDirectories(sourceDir: string, archiveDir: string, shouldArchive: (dirName: string) => boolean): Promise<number>;
//# sourceMappingURL=phase-filesystem-adapter.d.ts.map