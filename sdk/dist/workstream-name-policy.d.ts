/**
 * Workstream Name Policy Module
 *
 * Owns SDK-side workstream validation and slug normalization.
 */
/**
 * Validate a workstream name.
 * Allowed: alphanumeric, hyphens, underscores, dots.
 * Disallowed: empty, spaces, slashes, special chars, path traversal.
 */
export declare function validateWorkstreamName(name: string): boolean;
export declare function toWorkstreamSlug(name: string): string;
//# sourceMappingURL=workstream-name-policy.d.ts.map