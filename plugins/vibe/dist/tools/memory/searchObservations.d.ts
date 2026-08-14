import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { ObservationType } from '../../infra/lib/memory/ObservationStore.js';
export declare const searchObservationsDefinition: ToolDefinition;
interface SearchObservationsArgs {
    query?: string;
    type?: ObservationType;
    limit?: number;
    projectPath?: string;
}
export declare function searchObservations(args: SearchObservationsArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=searchObservations.d.ts.map