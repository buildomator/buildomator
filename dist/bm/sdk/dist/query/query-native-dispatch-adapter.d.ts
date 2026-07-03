import type { QueryRegistry } from './registry.js';
import type { QueryResult } from './utils.js';
export interface QueryNativeDispatchAdapter {
    dispatch(command: string, args: string[]): Promise<QueryResult>;
}
export declare function createQueryNativeDispatchAdapter(registry: QueryRegistry, projectDir: string, ws?: string): QueryNativeDispatchAdapter;
//# sourceMappingURL=query-native-dispatch-adapter.d.ts.map