/**
 * Secrets handling — TypeScript mirror of `get-shit-done/bin/lib/secrets.cjs`.
 *
 * Keys considered sensitive (`SECRET_CONFIG_KEYS`) are masked in any
 * machine-readable response from `config-set` / `config-get` so plaintext
 * credentials don't end up in workflow output, session transcripts, or
 * shell histories. The on-disk value is unchanged; only the response is masked.
 *
 * Behavior must match `secrets.cjs` exactly. A parity test asserts the
 * two modules expose the same set of secret keys and produce identical
 * masked output for representative inputs.
 *
 * Tracked in #2997 (security: SDK port lost masking behavior).
 */
export declare const SECRET_CONFIG_KEYS: ReadonlySet<string>;
export declare function isSecretKey(keyPath: string): boolean;
/**
 * Convention: ≥8 chars → `****<last-4>`; <8 chars → `****`; null/empty/undefined → `(unset)`.
 * Identical to `secrets.cjs` `maskSecret`.
 */
export declare function maskSecret(value: unknown): string;
/**
 * Helper: returns the value masked if `keyPath` is a secret, else the value
 * unchanged. Use at response-construction boundaries in query handlers.
 */
export declare function maskIfSecret<T>(keyPath: string, value: T): T | string;
//# sourceMappingURL=secrets.d.ts.map