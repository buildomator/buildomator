/**
 * Workstream utility functions for multi-workstream project support.
 *
 * When --ws <name> is provided, all .planning/ paths are routed to
 * .planning/workstreams/<name>/ instead.
 */
export { validateWorkstreamName, toWorkstreamSlug } from './workstream-name-policy.js';
/**
 * Return the relative planning directory path.
 *
 * - Without workstream: `.planning`
 * - With workstream: `.planning/workstreams/<name>`
 */
export declare function relPlanningPath(workstream?: string): string;
//# sourceMappingURL=workstream-utils.d.ts.map