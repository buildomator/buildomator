/**
 * Module owning typed hot-path method projection for GSDTools facade.
 */
export class QueryHotpathMethods {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    phaseComplete(phase) {
        return this.deps.dispatchNativeHotpath('phase', ['complete', phase], 'phase.complete', [phase], 'raw');
    }
    commit(message, files) {
        const args = [message];
        if (files?.length)
            args.push('--files', ...files);
        return this.deps.dispatchNativeHotpath('commit', args, 'commit', args, 'raw');
    }
    initPhaseOp(phaseNumber) {
        return this.deps.dispatchNativeHotpath('init', ['phase-op', phaseNumber], 'init.phase-op', [phaseNumber], 'json');
    }
    configGet(key) {
        return this.deps.dispatchNativeHotpath('config-get', [key], 'config-get', [key], 'json');
    }
    phasePlanIndex(phaseNumber) {
        return this.deps.dispatchNativeHotpath('phase-plan-index', [phaseNumber], 'phase-plan-index', [phaseNumber], 'json');
    }
    initNewProject() {
        return this.deps.dispatchNativeHotpath('init', ['new-project'], 'init.new-project', [], 'json');
    }
    configSet(key, value) {
        return this.deps.dispatchNativeHotpath('config-set', [key, value], 'config-set', [key, value], 'raw');
    }
}
//# sourceMappingURL=query-hotpath-methods.js.map