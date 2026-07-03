import { type QueryCliAdapterOutput } from './query-cli-output.js';
export interface QueryCliAdapterInput {
    projectDir: string;
    ws?: string;
    queryArgv?: string[];
}
export declare function runQueryCliCommand(input: QueryCliAdapterInput): Promise<QueryCliAdapterOutput>;
//# sourceMappingURL=query-cli-adapter.d.ts.map