import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const SRC_DIR = path.resolve(__dirname, '..');

type LayerName = 'cli' | 'tools' | 'infra/lib' | 'infra/orchestrator' | 'test-helpers';

/** Extract all static and dynamic import paths from a TypeScript source file */
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results: string[] = [];

  const staticRegex = /(?:import|export)\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match: RegExpExecArray | null;

  while ((match = staticRegex.exec(content)) !== null) {
    results.push(match[1]);
  }
  while ((match = dynamicRegex.exec(content)) !== null) {
    results.push(match[1]);
  }

  return results.filter((p) => p.startsWith('.') || p.startsWith('/'));
}

/**
 * Check whether every import of a given path in a file is type-only.
 * Returns true only if all matching import statements use `import type`.
 */
function importsAreTypeOnly(filePath: string, importPath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.includes(importPath)) continue;
    // Must match an import statement containing this path
    if (!/(?:import|export)/.test(line)) continue;
    // If the line is NOT a type-only import, return false
    if (/^\s*import\s+(?!type[\s{])/.test(line)) {
      return false;
    }
  }
  return true;
}

/** Resolve a relative import path to a layer category */
function categorizeImport(fromFile: string, importPath: string): LayerName | null {
  const fromDir = path.dirname(fromFile);
  // Strip .js extension for resolution
  const cleanImport = importPath.replace(/\.js$/, '');
  const resolved = path.resolve(fromDir, cleanImport);
  const relative = path.relative(SRC_DIR, resolved).replace(/\\/g, '/');

  if (relative.startsWith('cli/')) return 'cli';
  if (relative.startsWith('tools/')) return 'tools';
  if (relative.startsWith('infra/orchestrator/') || relative.startsWith('infra/lib/orchestrator')) return 'infra/orchestrator';
  if (relative.startsWith('infra/lib/') || relative.startsWith('infra/')) return 'infra/lib';
  if (relative.startsWith('test-helpers/')) return 'test-helpers';
  return null;
}

/** Collect all non-test .ts files in a layer directory (if it exists) */
function filesInLayer(layerRelPath: string): string[] {
  const layerDir = path.join(SRC_DIR, layerRelPath);
  if (!fs.existsSync(layerDir)) return [];
  return globSync('**/*.ts', { cwd: layerDir, absolute: true }).filter(
    (f) => !f.includes('__tests__') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts'),
  );
}

/** Build a layer-level dependency graph from all source files */
function buildLayerGraph(): Map<LayerName, Set<LayerName>> {
  const layers: LayerName[] = ['cli', 'tools', 'infra/lib', 'infra/orchestrator', 'test-helpers'];
  const graph = new Map<LayerName, Set<LayerName>>();
  for (const layer of layers) {
    graph.set(layer, new Set());
  }

  const layerDirMap: Record<LayerName, string> = {
    'cli': 'cli',
    'tools': 'tools',
    'infra/lib': 'infra/lib',
    'infra/orchestrator': 'infra/orchestrator',
    'test-helpers': 'test-helpers',
  };

  for (const [layer, relDir] of Object.entries(layerDirMap) as [LayerName, string][]) {
    const files = filesInLayer(relDir);
    for (const file of files) {
      const imports = extractImports(file);
      for (const imp of imports) {
        const target = categorizeImport(file, imp);
        if (target === null || target === layer) continue;
        // infra/lib may use type-only imports from cli/types — skip that edge
        if (layer === 'infra/lib' && target === 'cli') {
          const resolved = path.resolve(path.dirname(file), imp.replace(/\.js$/, ''));
          const relative = path.relative(SRC_DIR, resolved).replace(/\\/g, '/');
          if (relative.startsWith('cli/types') && importsAreTypeOnly(file, imp)) {
            continue;
          }
        }
        graph.get(layer)!.add(target);
      }
    }
  }

  return graph;
}

/** Detect cycles in a directed graph using DFS; returns cycle path or null */
function findCycle(graph: Map<LayerName, Set<LayerName>>): LayerName[] | null {
  const visited = new Set<LayerName>();
  const stack = new Set<LayerName>();
  const stackArr: LayerName[] = [];

  function dfs(node: LayerName): LayerName[] | null {
    visited.add(node);
    stack.add(node);
    stackArr.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (stack.has(neighbor)) {
        const cycleStart = stackArr.indexOf(neighbor);
        return [...stackArr.slice(cycleStart), neighbor];
      }
    }

    stack.delete(node);
    stackArr.pop();
    return null;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers for violation collection
// ---------------------------------------------------------------------------

function collectViolations(
  layerRelPath: string,
  forbiddenLayer: LayerName,
): string[] {
  const violations: string[] = [];
  const files = filesInLayer(layerRelPath);

  for (const file of files) {
    const imports = extractImports(file);
    for (const imp of imports) {
      const target = categorizeImport(file, imp);
      if (target === forbiddenLayer) {
        violations.push(`${path.relative(SRC_DIR, file)} → ${imp}`);
      }
    }
  }

  return violations;
}

function collectViolationsExceptTypeOnly(
  layerRelPath: string,
  forbiddenLayer: LayerName,
  allowedTypesPath: string,
): string[] {
  const violations: string[] = [];
  const files = filesInLayer(layerRelPath);

  for (const file of files) {
    const imports = extractImports(file);
    for (const imp of imports) {
      const target = categorizeImport(file, imp);
      if (target !== forbiddenLayer) continue;
      // Allow type-only imports from cli/types
      const resolved = path.resolve(path.dirname(file), imp.replace(/\.js$/, ''));
      const relative = path.relative(SRC_DIR, resolved).replace(/\\/g, '/');
      if (relative.startsWith(allowedTypesPath) && importsAreTypeOnly(file, imp)) {
        continue;
      }
      violations.push(`${path.relative(SRC_DIR, file)} → ${imp}`);
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Architecture boundary tests', () => {
  it('tools/ never imports from cli/', () => {
    const violations = collectViolations('tools', 'cli');
    expect(violations, `Forbidden imports found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('tools/ never imports from infra/orchestrator/', () => {
    const violations = collectViolations('tools', 'infra/orchestrator');
    expect(violations, `Forbidden imports found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('infra/lib/ never imports from cli/ (except type-only from cli/types)', () => {
    const violations = collectViolationsExceptTypeOnly('infra/lib', 'cli', 'cli/types');
    expect(violations, `Forbidden imports found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('infra/lib/ never imports from tools/', () => {
    const violations = collectViolations('infra/lib', 'tools');
    expect(violations, `Forbidden imports found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('infra/orchestrator/ never imports from cli/', () => {
    const violations = collectViolations('infra/orchestrator', 'cli');
    expect(violations, `Forbidden imports found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('infra/orchestrator/ never imports from tools/', () => {
    const violations = collectViolations('infra/orchestrator', 'tools');
    expect(violations, `Forbidden imports found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('no circular module dependencies between layers', () => {
    const graph = buildLayerGraph();
    const cycle = findCycle(graph);
    expect(cycle, `Circular dependency detected: ${cycle?.join(' → ')}`).toBeNull();
  });
});
