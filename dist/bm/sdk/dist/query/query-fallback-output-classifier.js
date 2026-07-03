import { readFile } from 'node:fs/promises';
async function parseCliQueryJsonOutput(raw, projectDir) {
    const trimmed = raw.trim();
    if (trimmed === '')
        return null;
    let jsonStr = trimmed;
    if (jsonStr.startsWith('@file:')) {
        const rel = jsonStr.slice(6).trim();
        const { resolvePathUnderProject } = await import('./helpers.js');
        const filePath = await resolvePathUnderProject(projectDir, rel);
        jsonStr = await readFile(filePath, 'utf-8');
    }
    return JSON.parse(jsonStr);
}
export async function classifyFallbackOutput(raw, projectDir) {
    if (raw.trim() === '') {
        return { mode: 'text', output: raw };
    }
    try {
        const output = await parseCliQueryJsonOutput(raw, projectDir);
        return { mode: 'json', output };
    }
    catch {
        return { mode: 'text', output: raw };
    }
}
//# sourceMappingURL=query-fallback-output-classifier.js.map