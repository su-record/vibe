// Tool for manually adding structured observations

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { ObservationType } from '../../infra/lib/memory/ObservationStore.js';

export const addObservationDefinition: ToolDefinition = {
  name: 'add_observation',
  description: 'Record a structured observation (decision, bugfix, feature, refactor, discovery)',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Observation type',
        enum: ['decision', 'bugfix', 'feature', 'refactor', 'discovery']
      },
      title: { type: 'string', description: 'Short title for the observation' },
      narrative: { type: 'string', description: 'Detailed description' },
      facts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key facts as bullet points'
      },
      concepts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags/categories for this observation'
      },
      filesModified: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files modified in this observation'
      },
      sessionId: { type: 'string', description: 'Session identifier' },
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: ['type', 'title']
  },
  annotations: {
    title: 'Add Observation',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
};

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

export async function addObservation(args: AddObservationArgs): Promise<ToolResult> {
  try {
    const mm = MemoryManager.getInstance(args.projectPath);
    const id = mm.addObservation({
      type: args.type,
      title: args.title,
      narrative: args.narrative,
      facts: args.facts,
      concepts: args.concepts,
      filesModified: args.filesModified,
      sessionId: args.sessionId,
      projectPath: args.projectPath,
    });

    return {
      content: [{
        type: 'text',
        text: `Observation #${id} recorded: [${args.type}] ${args.title}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
    };
  }
}
