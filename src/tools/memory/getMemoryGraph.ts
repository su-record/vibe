// v2.0 - Get memory graph structure (Knowledge Graph visualization)

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { MemoryManager } from '../../lib/MemoryManager.js';

export const getMemoryGraphDefinition: ToolDefinition = {
  name: 'get_memory_graph',
  description: `Retrieves the memory knowledge graph.

Keywords: graph, relations, connections, memory graph, knowledge graph

Examples:
- "Show me the relation graph for project-architecture"
- "View the entire memory graph"`,
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Starting memory key (if omitted, returns entire graph)'
      },
      depth: {
        type: 'number',
        description: 'Traversal depth (default: 2)',
        minimum: 1,
        maximum: 5
      },
      relationType: {
        type: 'string',
        description: 'Relation type to filter by'
      },
      format: {
        type: 'string',
        description: 'Output format',
        enum: ['tree', 'list', 'mermaid']
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path for project-specific memory'
      }
    }
  },
  annotations: {
    title: 'Get Memory Graph',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface GetMemoryGraphArgs {
  key?: string;
  depth?: number;
  relationType?: string;
  format?: 'tree' | 'list' | 'mermaid';
  projectPath?: string;
}

export async function getMemoryGraph(args: GetMemoryGraphArgs): Promise<ToolResult> {
  try {
    const { key, depth = 2, relationType, format = 'tree', projectPath } = args;
    const memoryManager = MemoryManager.getInstance(projectPath);

    const graph = memoryManager.getMemoryGraph(key, depth);

    if (graph.nodes.length === 0) {
      return {
        content: [{
          type: 'text',
          text: key
            ? `✗ Memory not found or has no relations: ${key}`
            : `✗ No memories stored`
        }]
      };
    }

    // Filter by relation type if specified
    let filteredEdges = graph.edges;
    if (relationType) {
      filteredEdges = graph.edges.filter(e => e.relationType === relationType);
    }

    let output = '';

    switch (format) {
      case 'mermaid':
        output = generateMermaidDiagram(graph.nodes, filteredEdges);
        break;
      case 'list':
        output = generateListFormat(graph.nodes, filteredEdges);
        break;
      case 'tree':
      default:
        output = generateTreeFormat(key, graph.nodes, filteredEdges);
    }

    // Add statistics
    const stats = `
---
**Statistics**
- Nodes: ${graph.nodes.length}
- Relations: ${filteredEdges.length}
- Clusters: ${graph.clusters.length}
${graph.clusters.length > 0 ? `- Cluster members: ${graph.clusters.map(c => `[${c.join(', ')}]`).join(', ')}` : ''}`;

    return {
      content: [{
        type: 'text',
        text: output + stats
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

function generateTreeFormat(startKey: string | undefined, nodes: any[], edges: any[]): string {
  let output = '## Memory Graph\n\n';

  if (startKey) {
    output += `**Starting point**: ${startKey}\n\n`;
  }

  // Build adjacency list
  const adjacency: Record<string, Array<{ target: string; type: string; strength: number }>> = {};

  for (const edge of edges) {
    if (!adjacency[edge.sourceKey]) {
      adjacency[edge.sourceKey] = [];
    }
    adjacency[edge.sourceKey].push({
      target: edge.targetKey,
      type: edge.relationType,
      strength: edge.strength
    });
  }

  // Generate tree view
  const visited = new Set<string>();

  function printNode(key: string, indent: number): string {
    if (visited.has(key)) return '';
    visited.add(key);

    const node = nodes.find(n => n.key === key);
    if (!node) return '';

    let result = '  '.repeat(indent) + `📦 **${key}** [${node.category}]\n`;

    const relations = adjacency[key] || [];
    for (const rel of relations) {
      const arrow = getRelationArrow(rel.type);
      result += '  '.repeat(indent + 1) + `${arrow} ${rel.target} (${rel.type}, ${rel.strength})\n`;
      result += printNode(rel.target, indent + 2);
    }

    return result;
  }

  if (startKey) {
    output += printNode(startKey, 0);
  } else {
    for (const node of nodes) {
      if (!visited.has(node.key)) {
        output += printNode(node.key, 0);
        output += '\n';
      }
    }
  }

  return output;
}

function generateListFormat(nodes: any[], edges: any[]): string {
  let output = '## Memory Graph (List)\n\n';

  output += '### Nodes\n';
  for (const node of nodes) {
    output += `- **${node.key}** [${node.category}]: ${node.value.substring(0, 50)}${node.value.length > 50 ? '...' : ''}\n`;
  }

  output += '\n### Relations\n';
  for (const edge of edges) {
    output += `- ${edge.sourceKey} --[${edge.relationType}]--> ${edge.targetKey} (strength: ${edge.strength})\n`;
  }

  return output;
}

function generateMermaidDiagram(nodes: any[], edges: any[]): string {
  let output = '## Memory Graph (Mermaid)\n\n```mermaid\ngraph LR\n';

  // Add nodes with categories as subgraphs
  const categories: Record<string, string[]> = {};
  for (const node of nodes) {
    if (!categories[node.category]) {
      categories[node.category] = [];
    }
    categories[node.category].push(node.key);
  }

  for (const [category, keys] of Object.entries(categories)) {
    output += `  subgraph ${category}\n`;
    for (const key of keys) {
      const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
      output += `    ${safeKey}["${key}"]\n`;
    }
    output += '  end\n';
  }

  // Add edges
  for (const edge of edges) {
    const sourceKey = edge.sourceKey.replace(/[^a-zA-Z0-9]/g, '_');
    const targetKey = edge.targetKey.replace(/[^a-zA-Z0-9]/g, '_');
    output += `  ${sourceKey} -->|${edge.relationType}| ${targetKey}\n`;
  }

  output += '```\n';

  return output;
}

function getRelationArrow(relationType: string): string {
  const arrows: Record<string, string> = {
    'related_to': '↔️',
    'depends_on': '⬅️',
    'implements': '🔧',
    'extends': '📈',
    'uses': '🔗',
    'references': '📎',
    'part_of': '📦'
  };
  return arrows[relationType] || '➡️';
}
