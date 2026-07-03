import type { InitNewProjectInfo, PhaseOpInfo, PhasePlanIndex } from './types.js';
export interface QueryHotpathMethodsDeps {
    dispatchNativeHotpath: (legacyCommand: string, legacyArgs: string[], registryCommand: string, registryArgs: string[], mode: 'json' | 'raw') => Promise<unknown>;
}
/**
 * Module owning typed hot-path method projection for GSDTools facade.
 */
export declare class QueryHotpathMethods {
    private readonly deps;
    constructor(deps: QueryHotpathMethodsDeps);
    phaseComplete(phase: string): Promise<string>;
    commit(message: string, files?: string[]): Promise<string>;
    initPhaseOp(phaseNumber: string): Promise<PhaseOpInfo>;
    configGet(key: string): Promise<string | null>;
    phasePlanIndex(phaseNumber: string): Promise<PhasePlanIndex>;
    initNewProject(): Promise<InitNewProjectInfo>;
    configSet(key: string, value: string): Promise<string>;
}
//# sourceMappingURL=query-hotpath-methods.d.ts.map