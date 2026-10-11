import type { CraftSkillCatalog } from './craft-skill-catalog.js';
export type LicenseVerdict = 'allow' | 'flag' | 'block';
export type LicenseCategory = 'permissive' | 'copyleft' | 'source-available' | 'non-commercial' | 'proprietary' | 'no-license' | 'unknown';
export interface LicenseAssessment {
    verdict: LicenseVerdict;
    spdx: string;
    category: LicenseCategory;
    obligations: string;
    reason: string;
}
export type SafetyFindingCode = 'publisher-not-allowlisted' | 'pin-not-commit' | 'scripts-unreviewed' | 'scripts-review-stale' | 'tier-c-hold' | 'tier-b-undeclared-execution' | 'tooling-license-missing' | 'tooling-license-blocked' | 'source-not-https' | 'entry-malformed' | 'external-validate-failed' | 'external-validate-unavailable';
export interface SafetyFinding {
    code: SafetyFindingCode;
    message: string;
}
export interface SafetyAssessment {
    safe: boolean;
    findings: SafetyFinding[];
    scripts_banned: boolean;
}
export interface ToolingAssessment {
    name: string;
    license: string;
    verdict: LicenseVerdict;
    category: LicenseCategory;
}
export interface EntryAssessment {
    id: string | undefined;
    verdict: LicenseVerdict;
    safety: SafetyAssessment;
    license: LicenseAssessment;
    tooling: ToolingAssessment[];
    scripts_banned: boolean;
    publisher: {
        id: string;
        label: string;
    } | null;
    pinned_commit: string | undefined;
    source: string | undefined;
    skill_path: string | undefined;
    trust_tier: string | undefined;
    prompt: string[];
}
export declare const SAFETY_FINDINGS: Record<SafetyFindingCode, string>;
export declare const SKILLS_REF_PIN = "skills-ref@0.1.5";
export declare function externalValidateArgv(dir: string): string[];
export interface ExternalValidateRun {
    status: number | null;
    stdout: string;
    stderr: string;
    error?: string;
}
export declare function normalizeSpdx(s: unknown): string;
export declare function classifyLicense(spdx: unknown, cat?: CraftSkillCatalog): LicenseAssessment;
export declare function checkSafety(entry: unknown, cat?: CraftSkillCatalog): SafetyAssessment;
export declare function assessEntry(entry: unknown, cat?: CraftSkillCatalog): EntryAssessment;
export declare function renderAssessment(assessment: EntryAssessment): string;
export declare function applyExternalValidation(assessment: EntryAssessment, run: ExternalValidateRun): EntryAssessment;
//# sourceMappingURL=skill-trust-gate.d.ts.map