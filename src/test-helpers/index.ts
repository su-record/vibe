/**
 * 공유 테스트 헬퍼 — 모든 테스트에서 재사용 가능한 유틸리티
 */

import { rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── 임시 디렉토리 관리 ───

/** 고유한 임시 테스트 디렉토리 생성 */
export function createTempDir(prefix = 'vibe-test'): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 임시 디렉토리 정리 (afterEach에서 사용) */
export function cleanupTempDir(dir: string): void {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors on Windows (file locking)
  }
}

// ─── 설정 팩토리 ───

export interface TestVibeConfig {
  stackTypes: string[];
  capabilities: string[];
  projectName?: string;
  details?: string;
}

/** 테스트용 vibe 프로젝트 설정 생성 */
export function createTestConfig(overrides: Partial<TestVibeConfig> = {}): TestVibeConfig {
  return {
    stackTypes: ['typescript-react'],
    capabilities: [],
    projectName: 'test-project',
    details: 'Test project for unit tests',
    ...overrides,
  };
}

/** 디스크에 테스트 설정 파일 생성 */
export function writeTestConfig(dir: string, config?: Partial<TestVibeConfig>): string {
  const configDir = join(dir, '.claude', 'vibe');
  mkdirSync(configDir, { recursive: true });
  const configPath = join(configDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(createTestConfig(config), null, 2));
  return configPath;
}

// ─── 스킬 픽스처 ───

export interface TestSkillOptions {
  name: string;
  description?: string;
  triggers?: string[];
  priority?: number;
  body?: string;
}

/** 테스트용 SKILL.md 생성 */
export function createTestSkill(dir: string, options: TestSkillOptions): string {
  const skillDir = join(dir, options.name);
  mkdirSync(skillDir, { recursive: true });

  const frontmatter = [
    '---',
    `name: ${options.name}`,
    `description: "${options.description ?? `Test skill ${options.name}`}"`,
  ];
  if (options.triggers) {
    frontmatter.push(`triggers: [${options.triggers.join(', ')}]`);
  }
  if (options.priority !== undefined) {
    frontmatter.push(`priority: ${options.priority}`);
  }
  frontmatter.push('---');

  const content = frontmatter.join('\n') + '\n\n' + (options.body ?? `# ${options.name}\n\nTest skill content.\n`);
  const filePath = join(skillDir, 'SKILL.md');
  writeFileSync(filePath, content);
  return filePath;
}

// ─── JSONL 헬퍼 ───

/** JSONL 파일에서 이벤트 파싱 */
export function parseJsonl<T = Record<string, unknown>>(content: string): T[] {
  return content
    .trim()
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as T);
}

// ─── 타이밍 유틸 ───

/** 지정 시간(ms) 대기 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 함수 실행 시간 측정 (ms) */
export async function measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}
