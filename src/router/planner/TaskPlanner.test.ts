/**
 * TaskPlanner Tests
 * DAG generation, cycle detection, validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPlanner, DAG } from './TaskPlanner.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockRouter(content: string): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue({ success: true, content }),
  } as unknown as SmartRouterLike;
}

const VALID_DAG_JSON = JSON.stringify({
  description: 'Test DAG',
  nodes: [
    { id: '1', type: 'research', action: 'web_search', dependsOn: [], params: {} },
    { id: '2', type: 'google', action: 'gmail_send', dependsOn: ['1'], params: {} },
  ],
});

const CYCLIC_DAG: DAG = {
  description: 'Cyclic',
  nodes: [
    { id: 'A', type: 'research', action: 'a', dependsOn: ['C'], params: {} },
    { id: 'B', type: 'research', action: 'b', dependsOn: ['A'], params: {} },
    { id: 'C', type: 'research', action: 'c', dependsOn: ['B'], params: {} },
  ],
};

describe('TaskPlanner', () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    mockLogger.mockClear();
    planner = new TaskPlanner(mockLogger, createMockRouter(VALID_DAG_JSON));
  });

  describe('parseDAG', () => {
    it('should parse valid DAG JSON', () => {
      const dag = planner.parseDAG(VALID_DAG_JSON);
      expect(dag.nodes).toHaveLength(2);
      expect(dag.nodes[0].id).toBe('1');
      expect(dag.nodes[1].dependsOn).toEqual(['1']);
    });

    it('should throw on invalid JSON', () => {
      expect(() => planner.parseDAG('not json')).toThrow('DAG JSON 파싱 실패');
    });
  });

  describe('validate', () => {
    it('should accept valid DAG', () => {
      const dag = planner.parseDAG(VALID_DAG_JSON);
      expect(() => planner.validate(dag)).not.toThrow();
    });

    it('should reject empty DAG', () => {
      const dag: DAG = { description: '', nodes: [] };
      expect(() => planner.validate(dag)).toThrow('노드가 없습니다');
    });

    it('should reject too many nodes', () => {
      const nodes = Array.from({ length: 11 }, (_, i) => ({
        id: String(i), type: 'research', action: 'a', dependsOn: [], params: {},
      }));
      expect(() => planner.validate({ description: '', nodes })).toThrow('노드 수 초과');
    });

    it('should reject invalid types', () => {
      const dag: DAG = {
        description: '',
        nodes: [{ id: '1', type: 'invalid_type', action: 'a', dependsOn: [], params: {} }],
      };
      expect(() => planner.validate(dag)).toThrow('허용되지 않은 타입');
    });

    it('should reject non-existent dependencies', () => {
      const dag: DAG = {
        description: '',
        nodes: [{ id: '1', type: 'research', action: 'a', dependsOn: ['99'], params: {} }],
      };
      expect(() => planner.validate(dag)).toThrow('존재하지 않는 의존성');
    });
  });

  describe('detectCycle', () => {
    it('should detect cyclic dependency (A→B→C→A)', () => {
      expect(() => planner.detectCycle(CYCLIC_DAG)).toThrow('순환 의존성');
    });

    it('should accept acyclic DAG', () => {
      const dag = planner.parseDAG(VALID_DAG_JSON);
      expect(() => planner.detectCycle(dag)).not.toThrow();
    });
  });

  describe('topologicalSort', () => {
    it('should return correct order', () => {
      const dag = planner.parseDAG(VALID_DAG_JSON);
      const order = TaskPlanner.topologicalSort(dag);
      expect(order).toEqual(['1', '2']);
    });

    it('should handle parallel nodes at same level', () => {
      const dag: DAG = {
        description: '',
        nodes: [
          { id: '1', type: 'research', action: 'a', dependsOn: [], params: {} },
          { id: '2', type: 'google', action: 'b', dependsOn: ['1'], params: {} },
          { id: '3', type: 'google', action: 'c', dependsOn: ['1'], params: {} },
        ],
      };
      const order = TaskPlanner.topologicalSort(dag);
      expect(order[0]).toBe('1');
      expect(order).toContain('2');
      expect(order).toContain('3');
    });
  });

  describe('plan', () => {
    it('should plan from natural language', async () => {
      const dag = await planner.plan('검색해서 메일로 보내줘');
      expect(dag.nodes).toHaveLength(2);
    });

    it('should throw on LLM failure', async () => {
      const failRouter = {
        route: vi.fn().mockResolvedValue({ success: false, content: '' }),
      } as unknown as SmartRouterLike;
      planner = new TaskPlanner(mockLogger, failRouter);
      await expect(planner.plan('test')).rejects.toThrow('복합 작업 분해에 실패');
    });
  });
});
