// TODO(parity): SDK lacks a TS test harness for normalizeFallowReport. CJS parity tests live in
// tests/feat-3210-fallow-integration.test.cjs (H1 suite). When a TS test runner is added,
// mirror those cases here — especially the line:0 preservation assertions.
export function normalizeFallowReport(report) {
    const unused = Array.isArray(report?.unusedExports) ? report.unusedExports : [];
    const duplicates = Array.isArray(report?.duplicates) ? report.duplicates : [];
    const circular = Array.isArray(report?.circularDependencies) ? report.circularDependencies : [];
    const findings = [];
    for (const item of unused) {
        findings.push({
            type: 'unused_export',
            message: `Unused export ${item.symbol || '<unknown>'}`,
            file: item.file || '',
            line: item.line ?? null,
        });
    }
    for (const item of duplicates) {
        findings.push({
            type: 'duplicate_block',
            message: `Duplicate block (${Math.round((item.similarity || 0) * 100)}% similarity)`,
            file: item.left?.file || '',
            line: item.left?.start ?? null,
            related_file: item.right?.file || '',
        });
    }
    for (const item of circular) {
        findings.push({
            type: 'circular_dependency',
            message: `Circular dependency: ${(item.cycle || []).join(' -> ')}`,
            file: Array.isArray(item.cycle) && item.cycle.length > 0 ? item.cycle[0] : '',
            line: null,
        });
    }
    return {
        summary: {
            unused_exports: unused.length,
            duplicates: duplicates.length,
            circular_dependencies: circular.length,
            total: findings.length,
        },
        findings,
    };
}
//# sourceMappingURL=fallow-audit.js.map