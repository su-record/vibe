import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { ObservationType } from '../../infra/lib/memory/ObservationStore.js';
export declare const addObservationDefinition: ToolDefinition;
interface AddObservationArgs {
    type: ObservationType;
    title: string;
    narrative?: string;
    facts?: string[];
    concepts?: string[];
    filesModified?: string[];
    sessionId?: string;
    projectPath?: string;
}
export declare function addObservation(args: AddObservationArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=addObservation.d.ts.map