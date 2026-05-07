/**
 * recipe-extractor.js — Phase 3 테스트
 *
 * 검증 범위:
 *  - 휴리스틱 게이트: total_tools≥8 AND fails≥3 AND last=success
 *  - VIBE_RECIPE_LLM=mock 으로 LLM 우회 (외부 의존 0)
 *  - frontmatter schema 충족
 *  - silent fail 정책 (jsonl 없음 / 게이트 실패 / 디렉토리 부재)
 *
 * 외부 의존:
 *  - 실제 claude CLI 는 호출하지 않음 (mock 모드 사용)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'recipe-extractor.js');

function makeTmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-recipe-extractor-'));
}

function writeJsonl(projectDir, records) {
  const dir = path.join(projectDir, '.vibe', 'metrics');
  fs.mkdirSync(dir, { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'current-run.jsonl'), lines);
}

function writeRunMeta(projectDir, meta) {
  const dir = path.join(projectDir, '.vibe', 'metrics');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'current-run.json'), JSON.stringify(meta));
}

function runExtractor(projectDir, { mock = true } = {}) {
  const result = spawnSync('node', [SCRIPT], {
    encoding: 'utf-8',
    timeout: 5000,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDir,
      ...(mock ? { VIBE_RECIPE_LLM: 'mock' } : {}),
      VIBE_HOOK_DEPTH: '0',
    },
  });
  return result;
}

function listRecipes(projectDir) {
  const dir = path.join(projectDir, '.vibe', 'recipes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
}

function makeRecord({ tool = 'Bash', ok = true, file = null, category = null }) {
  return {
    ts: new Date().toISOString(),
    tool,
    ok,
    target_file: file,
    error_category: ok ? null : category,
  };
}

describe('recipe-extractor (Phase 3)', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = makeTmpProject();
  });

  // ───────── 게이트 통과 조건 ─────────
  describe('휴리스틱 게이트', () => {
    it('총 ≥8 + 실패 ≥3 + 마지막 성공 → recipe 생성', () => {
      const records = [
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: false, category: 'auth' }),
        makeRecord({ ok: true }),
        makeRecord({ ok: true }),
        makeRecord({ ok: true, tool: 'Edit', file: 'src/foo.ts' }),
        makeRecord({ ok: true, tool: 'Read', file: 'src/foo.ts' }),
        makeRecord({ ok: true, tool: 'Bash' }), // 마지막=성공
      ];
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: 'auth-fix', startedAt: '2026-05-07T00:00:00.000Z', steps: 8 });

      const r = runExtractor(projectDir);
      expect(r.status).toBe(0);
      expect(listRecipes(projectDir)).toHaveLength(1);
    });

    it('툴콜 부족 (<8) → 생성 안 함', () => {
      const records = [
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: true }),
      ];
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: 'x' });
      runExtractor(projectDir);
      expect(listRecipes(projectDir)).toHaveLength(0);
    });

    it('실패 부족 (<3) → 생성 안 함', () => {
      const records = Array.from({ length: 10 }, () => makeRecord({ ok: true }));
      records[0] = makeRecord({ ok: false, category: 'other' });
      records[1] = makeRecord({ ok: false, category: 'other' });
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: 'x' });
      runExtractor(projectDir);
      expect(listRecipes(projectDir)).toHaveLength(0);
    });

    it('마지막 호출이 실패 → 생성 안 함 (task 미완료)', () => {
      const records = [
        ...Array.from({ length: 5 }, () => makeRecord({ ok: true })),
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: false, category: 'integration' }),
        makeRecord({ ok: false, category: 'integration' }),
      ];
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: 'x' });
      runExtractor(projectDir);
      expect(listRecipes(projectDir)).toHaveLength(0);
    });
  });

  // ───────── frontmatter 검증 ─────────
  describe('frontmatter schema', () => {
    function makeQualifyingRun() {
      const records = [
        makeRecord({ tool: 'Bash', ok: false, category: 'integration' }),
        makeRecord({ tool: 'Bash', ok: false, category: 'integration' }),
        makeRecord({ tool: 'Edit', file: 'src/foo.ts', ok: false, category: 'type-narrow' }),
        makeRecord({ tool: 'Edit', file: 'src/foo.ts', ok: true }),
        makeRecord({ tool: 'Read', file: 'src/foo.ts', ok: true }),
        makeRecord({ tool: 'Bash', ok: true }),
        makeRecord({ tool: 'Bash', ok: true }),
        makeRecord({ tool: 'Bash', ok: true }),
      ];
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: 'login flow', startedAt: '2026-05-07T10:00:00.000Z', steps: 8 });
    }

    it('생성된 recipe 의 frontmatter 가 schema 충족', () => {
      makeQualifyingRun();
      runExtractor(projectDir);
      const [filename] = listRecipes(projectDir);
      const content = fs.readFileSync(path.join(projectDir, '.vibe', 'recipes', filename), 'utf-8');

      expect(content).toMatch(/^---\n/);
      expect(content).toMatch(/^slug: login-flow__\d{8}-\d{6}$/m);
      expect(content).toMatch(/^type: recipe$/m);
      expect(content).toMatch(/^symptom-context: "login flow"$/m);
      expect(content).toMatch(/^recipe: ".+"$/m);
      expect(content).toMatch(/^tools-touched: \[/m);
      expect(content).toMatch(/^retry-count-saved: 3$/m);
      expect(content).toMatch(/^created: \d{4}-\d{2}-\d{2}$/m);
      expect(content).toMatch(/^source-run: "2026-05-07T10:00:00\.000Z"$/m);
      expect(content).toMatch(/^confidence: low$/m);
    });

    it('파일명이 timestamp slug 포함', () => {
      makeQualifyingRun();
      runExtractor(projectDir);
      const [filename] = listRecipes(projectDir);
      expect(filename).toMatch(/^login-flow__\d{8}-\d{6}\.md$/);
    });

    it('feature 누락 시 anon slug', () => {
      const records = Array.from({ length: 8 }, (_, i) => makeRecord({
        ok: i < 3 ? false : true,
        category: i < 3 ? 'integration' : null,
      }));
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: null });
      runExtractor(projectDir);
      const [filename] = listRecipes(projectDir);
      expect(filename).toMatch(/^anon__/);
    });
  });

  // ───────── 안전성 ─────────
  describe('silent fail 정책', () => {
    it('jsonl 없음 → exit 0, 파일 생성 안 함', () => {
      const r = runExtractor(projectDir);
      expect(r.status).toBe(0);
      expect(listRecipes(projectDir)).toHaveLength(0);
    });

    it('빈 jsonl → exit 0, 생성 안 함', () => {
      writeJsonl(projectDir, []);
      const r = runExtractor(projectDir);
      expect(r.status).toBe(0);
      expect(listRecipes(projectDir)).toHaveLength(0);
    });

    it('VIBE_HOOK_DEPTH≥1 → 재귀 가드, 생성 안 함', () => {
      const records = [
        ...Array.from({ length: 5 }, () => makeRecord({ ok: false, category: 'integration' })),
        makeRecord({ ok: true }), makeRecord({ ok: true }), makeRecord({ ok: true }),
      ];
      writeJsonl(projectDir, records);
      writeRunMeta(projectDir, { feature: 'x' });

      const r = spawnSync('node', [SCRIPT], {
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectDir,
          VIBE_RECIPE_LLM: 'mock',
          VIBE_HOOK_DEPTH: '1',
        },
      });
      expect(r.status).toBe(0);
      expect(listRecipes(projectDir)).toHaveLength(0);
    });

    it('손상된 jsonl 라인은 무시', () => {
      const dir = path.join(projectDir, '.vibe', 'metrics');
      fs.mkdirSync(dir, { recursive: true });
      // 일부 라인 손상 + 8개 정상
      const good = Array.from({ length: 8 }, (_, i) => JSON.stringify(makeRecord({
        ok: i < 3 ? false : true,
        category: i < 3 ? 'integration' : null,
      })));
      const lines = ['{ broken', ...good].join('\n') + '\n';
      fs.writeFileSync(path.join(dir, 'current-run.jsonl'), lines);
      writeRunMeta(projectDir, { feature: 'x' });

      const r = runExtractor(projectDir);
      expect(r.status).toBe(0);
      expect(listRecipes(projectDir)).toHaveLength(1);
    });
  });
});
