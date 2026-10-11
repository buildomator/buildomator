import type { QueryHandler } from './utils.js';
import type { GSDConfig } from '../config.js';
import type { EntryAssessment, LicenseVerdict } from '../skill-trust-gate.js';
export declare const PINS_RELATIVE_PATH = "craft-skills/pins.json";
export interface PinRecord {
    record_id: string;
    id: string;
    agent: string;
    mode: string;
    entry: string;
    source: string;
    skill_path: string;
    pinned_commit: string;
    pin_verified: boolean;
    local_head: string | null;
    skill_md_sha256: string;
    license: string;
    obligations: string;
    trust_tier: string;
    scripts_banned: boolean;
    verdict: string;
    approved_at: string;
    inserted_at: string;
    released_at: string | null;
}
export interface PinsFile {
    version: number;
    records: PinRecord[];
}
export declare function readPins(planningDir: string): PinsFile;
export declare function writePins(planningDir: string, pins: PinsFile): void;
export interface ParsedFlags {
    positional: string[];
    flags: Record<string, string | boolean>;
}
export declare function parseFlags(args: string[]): ParsedFlags;
export declare function readFrontmatterName(skillMdPath: string): string | null;
export declare function sha256File(p: string): string;
export interface PinCheck {
    git: boolean;
    local_head: string | null;
    pin_verified: boolean;
}
export declare function verifyLocalPin(skillDir: string, pinnedCommit: string): PinCheck;
export interface LocationResolution {
    ok: boolean;
    kind?: 'path' | 'global';
    entry?: string;
    skillDir?: string;
    skillMd?: string;
    reason?: string;
}
export declare function resolveLocation(projectDir: string, config: GSDConfig, location: string): LocationResolution;
export declare function findApproval(pins: PinsFile, id: string, pinnedCommit: string): PinRecord | null;
export interface InsertOpts {
    id?: string;
    agent?: string;
    location?: string;
    sticky?: boolean;
    approved?: boolean;
    catalog?: string;
}
export interface InsertNeedsApproval {
    inserted: false;
    needs_approval: true;
    verdict: LicenseVerdict;
    assessment: EntryAssessment;
    prompt: string[];
}
export interface InsertDone {
    inserted: true;
    id: string;
    agent: string;
    entry: string;
    mode: string;
    pinned_commit: string;
    pin_verified: boolean;
    record_id: string;
    prompt: string[];
}
export declare function insertCraftSkill(projectDir: string, opts: InsertOpts, workstream?: string): Promise<InsertNeedsApproval | InsertDone>;
export interface ReleaseOpts {
    agent?: string;
    id?: string;
    includeSticky?: boolean;
    all?: boolean;
}
export declare function releaseCraftSkills(projectDir: string, opts: ReleaseOpts, workstream?: string): Promise<{
    released: string[];
    remaining: number;
}>;
export declare function listCraftSkills(opts: {
    catalog?: string;
}): Array<Record<string, unknown>>;
export declare function assessCraftSkill(opts: {
    id?: string;
    catalog?: string;
    validateExternal?: string;
}): EntryAssessment;
export interface MatchCandidate {
    id: string;
    domain: string;
    matched_triggers: string[];
    publisher_label: string | null;
    license: string;
    obligations: string;
    trust_tier: string;
    verdict: LicenseVerdict;
    summary: string;
    target_agents: string[];
    prompt: string[];
}
export interface MatchResult {
    scope: string;
    candidates: MatchCandidate[];
}
export declare function matchCraftSkills(opts: {
    scope?: string;
    catalog?: string;
}): MatchResult;
export declare const craftSkillList: QueryHandler;
export declare const craftSkillAssess: QueryHandler;
export declare const craftSkillMatch: QueryHandler;
export declare const craftSkillInsert: QueryHandler;
export declare const craftSkillRelease: QueryHandler;
//# sourceMappingURL=craft-skill.d.ts.map