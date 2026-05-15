/**
 * GENERATED FILE — command alias expansion for state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.*, and non-family commands.
 * Source: sdk/src/query/command-manifest.{state,verify,init,phase,phases,validate,roadmap,non-family}.ts
 */
export interface FamilyCommandAlias {
    canonical: string;
    aliases: string[];
    subcommand: string;
    mutation: boolean;
}
export declare const STATE_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export declare const VERIFY_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export declare const INIT_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export declare const PHASE_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export declare const PHASES_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export declare const VALIDATE_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export declare const ROADMAP_COMMAND_ALIASES: readonly FamilyCommandAlias[];
export interface NonFamilyCommandAlias {
    canonical: string;
    aliases: string[];
    mutation: boolean;
}
export declare const NON_FAMILY_COMMAND_ALIASES: readonly NonFamilyCommandAlias[];
export declare const STATE_SUBCOMMANDS: Set<string>;
export declare const VERIFY_SUBCOMMANDS: Set<string>;
export declare const INIT_SUBCOMMANDS: Set<string>;
export declare const PHASE_SUBCOMMANDS: Set<string>;
export declare const PHASES_SUBCOMMANDS: Set<string>;
export declare const VALIDATE_SUBCOMMANDS: Set<string>;
export declare const ROADMAP_SUBCOMMANDS: Set<string>;
//# sourceMappingURL=command-aliases.generated.d.ts.map