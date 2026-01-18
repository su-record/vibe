// v2.0 - Link memories with relationships (Knowledge Graph)

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { MemoryManager } from '../../lib/MemoryManager.js';

export const linkMemoriesDefinition: ToolDefinition = {
  name: 'link_memories',
  description: `Links relationships between memories (knowledge graph).

Keywords: connect memories, link, relate, set relationship

Usage examples:
- "connect project-architecture and design-patterns"
- "link these two memories with related_to"`,
  inputSchema: {
    type: 'object',
    properties: {
      sourceKey: {
        type: 'string',
        description: 'Source memory key'
      },
      targetKey: {
        type: 'string',
        description: 'Target memory key'
      },
      relationType: {
        type: 'string',
        description: 'Relationship type (related_to, depends_on, implements, extends, uses)',
        enum: ['related_to', 'depends_on', 'implements', 'extends', 'uses', 'references', 'part_of']
      },
      strength: {
        type: 'number',
        description: 'Relationship strength (0.0 ~ 1.0, default: 1.0)',
        minimum: 0,
        maximum: 1
      },
      bidirectional: {
        type: 'boolean',
        description: 'Whether bidirectional relationship (default: false)'
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path for project-specific memory'
      }
    },
    required: ['sourceKey', 'targetKey', 'relationType']
  },
  annotations: {
    title: 'Link Memories',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface LinkMemoriesArgs {
  sourceKey: string;
  targetKey: string;
  relationType: string;
  strength?: number;
  bidirectional?: boolean;
  projectPath?: string;
}

export async function linkMemories(args: LinkMemoriesArgs): Promise<ToolResult> {
  try {
    const { sourceKey, targetKey, relationType, strength = 1.0, bidirectional = false, projectPath } = args;
    const memoryManager = MemoryManager.getInstance(projectPath);

    // Verify both memories exist
    const sourceMemory = memoryManager.recall(sourceKey);
    const targetMemory = memoryManager.recall(targetKey);

    if (!sourceMemory) {
      return {
        content: [{
          type: 'text',
          text: `✗ Source memory not found: ${sourceKey}`
        }]
      };
    }

    if (!targetMemory) {
      return {
        content: [{
          type: 'text',
          text: `✗ Target memory not found: ${targetKey}`
        }]
      };
    }

    // Create the link
    const success = memoryManager.linkMemories(sourceKey, targetKey, relationType, strength);

    if (!success) {
      return {
        content: [{
          type: 'text',
          text: `✗ Failed to link relationship`
        }]
      };
    }

    // Create bidirectional link if requested
    if (bidirectional) {
      memoryManager.linkMemories(targetKey, sourceKey, relationType, strength);
    }

    const result = `✓ Memory relationship linked

**Source**: ${sourceKey}
**Target**: ${targetKey}
**Relationship type**: ${relationType}
**Strength**: ${strength}
**Bidirectional**: ${bidirectional ? 'Yes' : 'No'}

You can now visualize the relationship with get_memory_graph.`;

    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
