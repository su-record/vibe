/**
 * TaskPlanner - LLM-based composite intent decomposition
 * Converts natural language → DAG (Directed Acyclic Graph)
 * Validates: JSON schema, cycle detection, whitelist
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

export interface DAGNode {
  id: string;
  type: string;
  action: string;
  dependsOn: string[];
  params: Record<string, unknown>;
}

export interface DAG {
  nodes: DAGNode[];
  description: string;
}

const MAX_NODES = 10;
const ALLOWED_TYPES = new Set([
  'development', 'google', 'research', 'utility', 'monitor',
]);

export class TaskPlanner {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Generate a DAG from a composite natural language request */
  async plan(query: string): Promise<DAG> {
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      prompt: query,
    });
    if (!result.success) {
      throw new Error('복합 작업 분해에 실패했습니다.');
    }
    const dag = this.parseDAG(result.content);
    this.validate(dag);
    return dag;
  }

  /** Parse LLM response into DAG structure */
  parseDAG(content: string): DAG {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('DAG JSON 파싱 실패');

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const nodes = this.extractNodes(parsed);
    const description = (parsed.description as string) ?? '';
    return { nodes, description };
  }

  /** Validate DAG: node count, cycles, types */
  validate(dag: DAG): void {
    if (dag.nodes.length === 0) {
      throw new Error('DAG에 노드가 없습니다.');
    }
    if (dag.nodes.length > MAX_NODES) {
      throw new Error(`DAG 노드 수 초과 (최대 ${MAX_NODES}개, 현재 ${dag.nodes.length}개)`);
    }
    this.validateTypes(dag);
    this.detectCycle(dag);
    this.validateDependencies(dag);
  }

  /** Detect cycles using topological sort (Kahn's algorithm) */
  detectCycle(dag: DAG): void {
    const nodeIds = new Set(dag.nodes.map((n) => n.id));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const node of dag.nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    for (const node of dag.nodes) {
      for (const dep of node.dependsOn) {
        if (!nodeIds.has(dep)) continue;
        const targets = adjList.get(dep) ?? [];
        targets.push(node.id);
        adjList.set(dep, targets);
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited++;
      for (const neighbor of adjList.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (visited !== dag.nodes.length) {
      throw new Error('순환 의존성이 감지되었습니다.');
    }
  }

  /** Get topological order of DAG nodes */
  static topologicalSort(dag: DAG): string[] {
    const nodeIds = new Set(dag.nodes.map((n) => n.id));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const node of dag.nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    for (const node of dag.nodes) {
      for (const dep of node.dependsOn) {
        if (!nodeIds.has(dep)) continue;
        adjList.get(dep)!.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const neighbor of adjList.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }
    return order;
  }

  private extractNodes(parsed: Record<string, unknown>): DAGNode[] {
    const rawNodes = (parsed.nodes ?? parsed.steps ?? []) as unknown[];
    if (!Array.isArray(rawNodes)) throw new Error('DAG nodes 배열이 필요합니다.');

    return rawNodes.map((raw, idx) => {
      const node = raw as Record<string, unknown>;
      return {
        id: String(node.id ?? idx + 1),
        type: String(node.type ?? 'utility'),
        action: String(node.action ?? ''),
        dependsOn: Array.isArray(node.dependsOn)
          ? node.dependsOn.map(String)
          : [],
        params: (typeof node.params === 'object' && node.params !== null)
          ? node.params as Record<string, unknown>
          : {},
      };
    });
  }

  private validateTypes(dag: DAG): void {
    for (const node of dag.nodes) {
      if (!ALLOWED_TYPES.has(node.type)) {
        throw new Error(`허용되지 않은 타입: ${node.type} (노드 ${node.id})`);
      }
    }
  }

  private validateDependencies(dag: DAG): void {
    const nodeIds = new Set(dag.nodes.map((n) => n.id));
    for (const node of dag.nodes) {
      for (const dep of node.dependsOn) {
        if (!nodeIds.has(dep)) {
          throw new Error(`존재하지 않는 의존성: ${dep} (노드 ${node.id})`);
        }
      }
    }
  }
}

const PLANNER_SYSTEM_PROMPT = `복합 작업을 DAG(Directed Acyclic Graph)로 분해하세요.
JSON 형식으로 반환:
{
  "description": "작업 설명",
  "nodes": [
    { "id": "1", "type": "research", "action": "web_search", "dependsOn": [], "params": {} },
    { "id": "2", "type": "google", "action": "gmail_send", "dependsOn": ["1"], "params": {} }
  ]
}
타입: development, google, research, utility, monitor
의존성: dependsOn에 선행 노드 id 배열
최대 10개 노드`;
