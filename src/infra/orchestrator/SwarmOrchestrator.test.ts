/**
 * SwarmOrchestrator 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { SwarmOrchestrator, analyzeTaskComplexity } from './SwarmOrchestrator.js';

describe('SwarmOrchestrator', () => {
  describe('analyzeTaskComplexity', () => {
    it('간단한 프롬프트는 낮은 복잡도', async () => {
      const analysis = await analyzeTaskComplexity('Fix a typo in README');
      expect(analysis.score).toBeLessThan(10);
    });

    it('복잡한 프롬프트는 높은 복잡도', async () => {
      const complexPrompt = `
        Implement a complete login feature:
        1. Create the login form UI with React
        2. Add form validation with Zod
        3. Implement the API endpoint with authentication
        4. Add error handling and loading states
        5. Write unit tests for all components
        6. Add security measures against CSRF
      `;
      const analysis = await analyzeTaskComplexity(complexPrompt);
      expect(analysis.score).toBeGreaterThan(15);
      expect(analysis.suggestedSplits?.length).toBeGreaterThan(1);
    });

    it('파일 언급이 많으면 복잡도 증가', async () => {
      const prompt = 'Update login.ts, auth.ts, user.ts, session.ts, and middleware.ts';
      const analysis = await analyzeTaskComplexity(prompt);
      expect(analysis.factors).toContain('5-files');
    });

    it('숫자 목록은 분할 제안 생성', async () => {
      const prompt = `
        1. First do this task
        2. Then do second task
        3. Finally do third task
      `;
      const analysis = await analyzeTaskComplexity(prompt);
      expect(analysis.suggestedSplits?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('SwarmOrchestrator 인스턴스', () => {
    it('기본 설정으로 생성', () => {
      const orchestrator = new SwarmOrchestrator({
        prompt: 'Test prompt'
      });
      expect(orchestrator).toBeDefined();
    });

    it('커스텀 설정으로 생성', () => {
      const onSplit = vi.fn();
      const onComplete = vi.fn();

      const orchestrator = new SwarmOrchestrator({
        prompt: 'Test prompt',
        agentName: 'test-agent',
        maxDepth: 3,
        splitThreshold: 20,
        maxConcurrentChildren: 3,
        onSplit,
        onComplete,
        timeout: 60000
      });
      expect(orchestrator).toBeDefined();
    });
  });

  describe('분할 로직', () => {
    it('maxDepth 도달 시 분할 안함', async () => {
      // maxDepth: 0으로 설정하면 분할하지 않음
      const orchestrator = new SwarmOrchestrator({
        prompt: `
          1. Task one
          2. Task two
          3. Task three
        `,
        maxDepth: 0
      });

      // shouldSplit가 false 반환 확인 (내부 로직)
      // @ts-expect-error - private method access for testing
      const task = orchestrator.createTask('test', null, 0);
      // @ts-expect-error - private method access for testing
      const shouldSplit = orchestrator.shouldSplit(task, { score: 50, factors: [], suggestedSplits: ['a', 'b'] });
      expect(shouldSplit).toBe(false);
    });

    it('splitThreshold 미만이면 분할 안함', async () => {
      const orchestrator = new SwarmOrchestrator({
        prompt: 'Simple task',
        splitThreshold: 100
      });

      // @ts-expect-error - private method access for testing
      const task = orchestrator.createTask('test', null, 0);
      // @ts-expect-error - private method access for testing
      const shouldSplit = orchestrator.shouldSplit(task, { score: 50, factors: [], suggestedSplits: ['a', 'b'] });
      expect(shouldSplit).toBe(false);
    });
  });
});
