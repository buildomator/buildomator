import type { OutputMode } from './command-manifest.types.js';
export interface NonFamilyCommandManifestEntry {
    canonical: string;
    aliases: string[];
    mutation: boolean;
    outputMode: OutputMode;
}
export declare const NON_FAMILY_COMMAND_MANIFEST: readonly NonFamilyCommandManifestEntry[];
//# sourceMappingURL=command-manifest.non-family.d.ts.map