// v2.0 - Analyze code dependency graph

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { ProjectCache } from '../../lib/ProjectCache.js';
import { Node, SyntaxKind } from 'ts-morph';

export const analyzeDependencyGraphDefinition: ToolDefinition = {
  name: 'analyze_dependency_graph',
  description: `Analyzes code dependency graphs.

Keywords: dependency, relationship analysis, circular reference, dependency graph, circular dependency

**Analysis includes:**
- Import/export relationships between files
- Circular dependency detection
- Module cluster identification
- Code coupling analysis

Usage examples:
- "Analyze dependency graph in src folder"
- "Show dependencies of index.ts"`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Project path'
      },
      targetFile: {
        type: 'string',
        description: 'Specific file to analyze (optional)'
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum traversal depth (default: 3)'
      },
      includeExternal: {
        type: 'boolean',
        description: 'Include external packages (default: false)'
      },
      detectCircular: {
        type: 'boolean',
        description: 'Detect circular dependencies (default: true)'
      }
    },
    required: ['projectPath']
  },
  annotations: {
    title: 'Analyze Dependency Graph',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface AnalyzeDependencyGraphArgs {
  projectPath: string;
  targetFile?: string;
  maxDepth?: number;
  includeExternal?: boolean;
  detectCircular?: boolean;
}

interface DependencyNode {
  file: string;
  imports: string[];
  exports: string[];
  depth: number;
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: Array<{ from: string; to: string; type: 'import' | 'export' }>;
  circularDependencies: string[][];
  clusters: string[][];
}

export async function analyzeDependencyGraph(args: AnalyzeDependencyGraphArgs): Promise<ToolResult> {
  try {
    const {
      projectPath,
      targetFile,
      maxDepth = 3,
      includeExternal = false,
      detectCircular = true
    } = args;

    const project = ProjectCache.getInstance().getOrCreate(projectPath);
    const sourceFiles = project.getSourceFiles();

    if (sourceFiles.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `✗ No source files found in project: ${projectPath}`
        }]
      };
    }

    const graph: DependencyGraph = {
      nodes: [],
      edges: [],
      circularDependencies: [],
      clusters: []
    };

    const fileMap = new Map<string, DependencyNode>();
    const adjacencyList = new Map<string, Set<string>>();

    // Build dependency graph
    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      const relativePath = getRelativePath(filePath, projectPath);

      // Skip if targeting specific file and this isn't it or related
      if (targetFile && !relativePath.includes(targetFile) && !shouldIncludeInGraph(relativePath, targetFile, maxDepth)) {
        continue;
      }

      const imports: string[] = [];
      const exports: string[] = [];

      // Get imports
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const imp of importDeclarations) {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        // Skip external packages unless requested
        if (!includeExternal && (moduleSpecifier.startsWith('@') || !moduleSpecifier.startsWith('.'))) {
          continue;
        }

        const resolvedPath = resolveImportPath(moduleSpecifier, filePath, projectPath);
        if (resolvedPath) {
          imports.push(resolvedPath);

          // Add edge
          graph.edges.push({
            from: relativePath,
            to: resolvedPath,
            type: 'import'
          });

          // Update adjacency list
          if (!adjacencyList.has(relativePath)) {
            adjacencyList.set(relativePath, new Set());
          }
          adjacencyList.get(relativePath)!.add(resolvedPath);
        }
      }

      // Get exports
      const exportDeclarations = sourceFile.getExportDeclarations();
      for (const exp of exportDeclarations) {
        const namedExports = exp.getNamedExports();
        for (const named of namedExports) {
          exports.push(named.getName());
        }
      }

      // Also get exported declarations
      const exportedDeclarations = sourceFile.getExportedDeclarations();
      exportedDeclarations.forEach((declarations: any[], name: string) => {
        if (!exports.includes(name)) {
          exports.push(name);
        }
      });

      const node: DependencyNode = {
        file: relativePath,
        imports,
        exports,
        depth: 0
      };

      fileMap.set(relativePath, node);
      graph.nodes.push(node);
    }

    // Detect circular dependencies
    if (detectCircular) {
      graph.circularDependencies = findCircularDependencies(adjacencyList);
    }

    // Detect clusters (strongly connected components)
    graph.clusters = findClusters(adjacencyList);

    // Generate output
    let output = `## Dependency Graph Analysis\n\n`;
    output += `**Project**: ${projectPath}\n`;
    output += `**Files analyzed**: ${graph.nodes.length}\n`;
    output += `**Dependencies**: ${graph.edges.length}\n\n`;

    // Show target file dependencies if specified
    if (targetFile) {
      const targetNode = graph.nodes.find(n => n.file.includes(targetFile));
      if (targetNode) {
        output += `### ${targetFile} Dependencies\n\n`;
        output += `**Imports** (${targetNode.imports.length}):\n`;
        for (const imp of targetNode.imports) {
          output += `- ← ${imp}\n`;
        }
        output += `\n**Exports** (${targetNode.exports.length}):\n`;
        for (const exp of targetNode.exports) {
          output += `- → ${exp}\n`;
        }
        output += '\n';
      }
    }

    // Circular dependencies warning
    if (graph.circularDependencies.length > 0) {
      output += `### ⚠️ Circular Dependencies Detected\n\n`;
      for (const cycle of graph.circularDependencies) {
        output += `- ${cycle.join(' → ')} → ${cycle[0]}\n`;
      }
      output += '\n';
    }

    // Clusters
    if (graph.clusters.length > 0) {
      output += `### Module Clusters\n\n`;
      for (let i = 0; i < graph.clusters.length; i++) {
        if (graph.clusters[i].length > 1) {
          output += `**Cluster ${i + 1}** (${graph.clusters[i].length} files):\n`;
          for (const file of graph.clusters[i].slice(0, 5)) {
            output += `  - ${file}\n`;
          }
          if (graph.clusters[i].length > 5) {
            output += `  - ... and ${graph.clusters[i].length - 5} more\n`;
          }
          output += '\n';
        }
      }
    }

    // Mermaid diagram for small graphs
    if (graph.nodes.length <= 20) {
      output += `### Dependency Diagram\n\n`;
      output += generateMermaidDiagram(graph);
    }

    // Statistics
    output += `### Statistics\n\n`;
    output += generateStatistics(graph);

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `✗ Dependency analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

function getRelativePath(filePath: string, projectPath: string): string {
  const normalizedFile = filePath.replace(/\\/g, '/');
  const normalizedProject = projectPath.replace(/\\/g, '/');
  return normalizedFile.replace(normalizedProject, '').replace(/^\//, '');
}

function resolveImportPath(moduleSpecifier: string, fromFile: string, projectPath: string): string | null {
  if (!moduleSpecifier.startsWith('.')) {
    return null;
  }

  // Simple resolution - in real implementation would use ts-morph's resolution
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
  let resolved = moduleSpecifier;

  if (moduleSpecifier.startsWith('./')) {
    resolved = `${fromDir}/${moduleSpecifier.substring(2)}`;
  } else if (moduleSpecifier.startsWith('../')) {
    const parts = fromDir.split('/');
    const upCount = (moduleSpecifier.match(/\.\.\//g) || []).length;
    parts.splice(-upCount);
    resolved = `${parts.join('/')}/${moduleSpecifier.replace(/\.\.\//g, '')}`;
  }

  // Add .ts extension if missing
  if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
    resolved += '.ts';
  }

  return getRelativePath(resolved, projectPath);
}

function shouldIncludeInGraph(file: string, targetFile: string, maxDepth: number): boolean {
  // Simple heuristic - include files in same or nearby directories
  const targetDir = targetFile.substring(0, targetFile.lastIndexOf('/'));
  return file.startsWith(targetDir);
}

function findCircularDependencies(adjacencyList: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjacencyList.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycles.push([...cycle]);
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const node of adjacencyList.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

function findClusters(adjacencyList: Map<string, Set<string>>): string[][] {
  // Simple connected components using Union-Find
  const parent: Record<string, string> = {};

  for (const node of adjacencyList.keys()) {
    parent[node] = node;
  }

  function find(x: string): string {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent[px] = py;
    }
  }

  for (const [node, neighbors] of adjacencyList) {
    for (const neighbor of neighbors) {
      if (parent[neighbor] !== undefined) {
        union(node, neighbor);
      }
    }
  }

  const clusters: Record<string, string[]> = {};
  for (const node of adjacencyList.keys()) {
    const root = find(node);
    if (!clusters[root]) {
      clusters[root] = [];
    }
    clusters[root].push(node);
  }

  return Object.values(clusters).filter(c => c.length > 1);
}

function generateMermaidDiagram(graph: DependencyGraph): string {
  let diagram = '```mermaid\ngraph TD\n';

  // Add nodes
  for (const node of graph.nodes) {
    const id = node.file.replace(/[^a-zA-Z0-9]/g, '_');
    const label = node.file.split('/').pop() || node.file;
    diagram += `  ${id}["${label}"]\n`;
  }

  // Add edges
  for (const edge of graph.edges) {
    const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    diagram += `  ${fromId} --> ${toId}\n`;
  }

  diagram += '```\n';
  return diagram;
}

function generateStatistics(graph: DependencyGraph): string {
  // Calculate metrics
  const importCounts = new Map<string, number>();
  const exportCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    importCounts.set(edge.to, (importCounts.get(edge.to) || 0) + 1);
    exportCounts.set(edge.from, (exportCounts.get(edge.from) || 0) + 1);
  }

  // Most imported files
  const topImported = [...importCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Files with most dependencies
  const topDependencies = graph.nodes
    .map(n => ({ file: n.file, count: n.imports.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let stats = `- **Total files**: ${graph.nodes.length}\n`;
  stats += `- **Total dependencies**: ${graph.edges.length}\n`;
  stats += `- **Circular dependencies**: ${graph.circularDependencies.length}\n`;
  stats += `- **Clusters**: ${graph.clusters.length}\n\n`;

  if (topImported.length > 0) {
    stats += `**Most referenced files**:\n`;
    for (const [file, count] of topImported) {
      stats += `- ${file}: ${count} times\n`;
    }
    stats += '\n';
  }

  if (topDependencies.length > 0) {
    stats += `**Files with most dependencies**:\n`;
    for (const { file, count } of topDependencies) {
      stats += `- ${file}: ${count} imports\n`;
    }
  }

  return stats;
}
