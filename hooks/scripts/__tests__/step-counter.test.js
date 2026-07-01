/**
 * step-counter.js — Phase 1 + Phase 2 테스트
 *
 * 검증 범위:
 *  - 책임 1) current-run.json steps 증가 (회귀 테스트)
 *  - 책임 2) current-run.jsonl append (Phase 1)
 *  - 책임 3) error_category 분류기 + 3-fail detector → anti-pattern md (Phase 2)
 *  - 책임 간 독립성, hot-path 안정성
 *
 * 패턴: 훅 스크립트 공통의 execFileSync 방식.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'step-counter.js');

/**
 * 격리된 임시 프로젝트에서 step-counter 를 1회 실행.
 * stdin 으로 PostToolUse payload 전달.
 */
function runCounter({ payload, projectDir }) {
  const result = spawnSync('node', [SCRIPT], {
    input: payload ? JSON.stringify(payload) : '',
    encoding: 'utf-8',
    timeout: 5000,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDir,
      // VIBE_HOOK_DEPTH 미설정 — 재귀 가드 영향 없음
    },
  });
  return result;
}

function makeTmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-step-counter-'));
  // .vibe/metrics/ 는 step-counter 가 직접 생성하도록 미리 만들지 않음
  return dir;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function readJsonl(p) {
  return fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

describe('step-counter PostToolUse hook', () => {
  let projectDir;
  let runJson;
  let runJsonl;

  beforeEach(() => {
    projectDir = makeTmpProject();
    runJson = path.join(projectDir, '.vibe', 'metrics', 'current-run.json');
    runJsonl = path.join(projectDir, '.vibe', 'metrics', 'current-run.jsonl');
  });

  // ───────── 책임 1 회귀 ─────────
  describe('책임 1: current-run.json 카운터', () => {
    it('첫 호출 시 steps=1, startedAt 채움', () => {
      const r = runCounter({
        payload: { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { is_error: false } },
        projectDir,
      });
      expect(r.status).toBe(0);
      const data = readJson(runJson);
      expect(data.steps).toBe(1);
      expect(data.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('연속 호출 시 steps 누적 (10이벤트 재작성 주기 고려)', () => {
      // 10이벤트마다 재작성 — 10회 호출 후에는 steps=10 이 보장됨
      for (let i = 0; i < 10; i++) {
        runCounter({
          payload: { tool_name: 'Bash', tool_input: { command: 'echo hi' }, tool_response: {} },
          projectDir,
        });
      }
      const data = readJson(runJson);
      expect(data.steps).toBe(10);
    });

    it('손상된 JSON 이 있어도 새로 시작 (10회 후 재작성으로 확인)', () => {
      fs.mkdirSync(path.join(projectDir, '.vibe', 'metrics'), { recursive: true });
      fs.writeFileSync(runJson, '{ broken json');
      // 10회 호출해야 재작성 주기 도달
      for (let i = 0; i < 10; i++) {
        runCounter({
          payload: { tool_name: 'Bash', tool_input: {}, tool_response: {} },
          projectDir,
        });
      }
      const data = readJson(runJson);
      expect(data.steps).toBe(10);
      expect(data.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ───────── 책임 2 신규 ─────────
  describe('책임 2: current-run.jsonl 로깅', () => {
    it('툴콜 1회 = jsonl 1라인', () => {
      runCounter({
        payload: { tool_name: 'Edit', tool_input: { file_path: 'src/foo.ts' }, tool_response: {} },
        projectDir,
      });
      const lines = readJsonl(runJsonl);
      expect(lines).toHaveLength(1);
      expect(lines[0].tool).toBe('Edit');
      expect(lines[0].ok).toBe(true);
      expect(lines[0].target_file).toBe('src/foo.ts');
      expect(lines[0].error_category).toBeNull();
      expect(lines[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('tool_response.is_error=true 면 ok=false', () => {
      runCounter({
        payload: { tool_name: 'Bash', tool_input: { command: 'false' }, tool_response: { is_error: true } },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.ok).toBe(false);
    });

    it('절대 경로 file_path 를 프로젝트 상대 경로로 정규화', () => {
      const abs = path.join(projectDir, 'src', 'bar.ts');
      runCounter({
        payload: { tool_name: 'Write', tool_input: { file_path: abs }, tool_response: {} },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.target_file).toBe('src/bar.ts');
    });

    it('file_path 없는 툴콜은 target_file=null', () => {
      runCounter({
        payload: { tool_name: 'Bash', tool_input: { command: 'pwd' }, tool_response: {} },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.target_file).toBeNull();
    });

    it('tool_name 없으면 jsonl 라인 안 씀 (steps 는 증가)', () => {
      runCounter({ payload: {}, projectDir });
      expect(fs.existsSync(runJsonl)).toBe(false);
      expect(readJson(runJson).steps).toBe(1);
    });

    it('연속 호출 시 jsonl 누적 (Read는 조기 종료 — 기록 안 됨)', () => {
      // Read 는 READ_ONLY_TOOLS 조기 종료 → jsonl 미기록
      runCounter({
        payload: { tool_name: 'Read', tool_input: { file_path: 'a.ts' }, tool_response: {} },
        projectDir,
      });
      runCounter({
        payload: { tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, tool_response: {} },
        projectDir,
      });
      const lines = readJsonl(runJsonl);
      expect(lines).toHaveLength(1);
      expect(lines[0].tool).toBe('Edit');
    });
  });

  // ───────── 독립성 ─────────
  describe('두 책임의 독립성', () => {
    it('payload 가 비어 stdin 무효여도 카운터는 증가', () => {
      const r = runCounter({ payload: null, projectDir });
      expect(r.status).toBe(0);
      expect(readJson(runJson).steps).toBe(1);
    });
  });

  // ───────── Phase 2: error_category 분류 ─────────
  describe('책임 3a: error_category 분류기', () => {
    it('TypeError of undefined → nullability', () => {
      runCounter({
        payload: {
          tool_name: 'Bash',
          tool_input: { command: 'node x.js' },
          tool_response: { is_error: true, error: "TypeError: Cannot read properties of undefined (reading 'foo')" },
        },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.error_category).toBe('nullability');
    });

    it('TS2345 → type-narrow', () => {
      runCounter({
        payload: {
          tool_name: 'Bash',
          tool_input: { command: 'tsc' },
          tool_response: { is_error: true, error: "src/x.ts(3,4): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'." },
        },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.error_category).toBe('type-narrow');
    });

    it('ECONNREFUSED → integration', () => {
      runCounter({
        payload: {
          tool_name: 'Bash',
          tool_input: { command: 'curl' },
          tool_response: { is_error: true, error: 'connect ECONNREFUSED 127.0.0.1:5432' },
        },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.error_category).toBe('integration');
    });

    it('알 수 없는 에러 → other', () => {
      runCounter({
        payload: {
          tool_name: 'Bash',
          tool_input: { command: 'x' },
          tool_response: { is_error: true, error: 'some unrecognized failure mode 12345' },
        },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.error_category).toBe('other');
    });

    it('성공 툴콜은 error_category=null', () => {
      runCounter({
        payload: { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { is_error: false } },
        projectDir,
      });
      const [line] = readJsonl(runJsonl);
      expect(line.ok).toBe(true);
      expect(line.error_category).toBeNull();
    });
  });

  // ───────── Phase 2: 3-fail detector ─────────
  describe('책임 3b: 3-fail detector → anti-pattern md', () => {
    function failBash(command, errorText, projectDir) {
      runCounter({
        payload: {
          tool_name: 'Bash',
          tool_input: { command },
          tool_response: { is_error: true, error: errorText },
        },
        projectDir,
      });
    }

    function listAntiPatterns(projectDir) {
      const dir = path.join(projectDir, '.vibe', 'anti-patterns');
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    }

    it('같은 (file, category) 3회 누적 시 anti-pattern md 생성', () => {
      const err = "TypeError: Cannot read properties of undefined (reading 'x')";
      // file_path 없는 Bash 실패 3회 → target_file=null, category=nullability
      for (let i = 0; i < 3; i++) failBash(`run-${i}`, err, projectDir);
      const files = listAntiPatterns(projectDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^nullability__global__\d{8}\.md$/);
    });

    it('2회만 누적되면 생성 안 함', () => {
      const err = 'connect ECONNREFUSED foo';
      for (let i = 0; i < 2; i++) failBash(`x-${i}`, err, projectDir);
      expect(listAntiPatterns(projectDir)).toHaveLength(0);
    });

    it('3회지만 카테고리 다르면 생성 안 함', () => {
      failBash('a', "Cannot read properties of undefined", projectDir); // nullability
      failBash('b', "ECONNREFUSED", projectDir);                         // integration
      failBash('c', "TS2345 not assignable", projectDir);                // type-narrow
      expect(listAntiPatterns(projectDir)).toHaveLength(0);
    });

    it('동일 (file, category) 4회 — md 1개만 (dedup)', () => {
      const err = "TypeError: Cannot read properties of undefined";
      for (let i = 0; i < 4; i++) failBash(`r-${i}`, err, projectDir);
      expect(listAntiPatterns(projectDir)).toHaveLength(1);
    });

    it('frontmatter 가 schema 충족', () => {
      const err = "TypeError: Cannot read properties of null";
      for (let i = 0; i < 3; i++) failBash(`r-${i}`, err, projectDir);
      const [filename] = listAntiPatterns(projectDir);
      const content = fs.readFileSync(path.join(projectDir, '.vibe', 'anti-patterns', filename), 'utf-8');
      expect(content).toMatch(/^---\n/);
      expect(content).toMatch(/^slug: nullability__global__\d{8}$/m);
      expect(content).toMatch(/^type: anti-pattern$/m);
      expect(content).toMatch(/^root-cause-tag: nullability$/m);
      expect(content).toMatch(/^trigger-signature: "/m);
      expect(content).toMatch(/^fail-count: 3$/m);
      expect(content).toMatch(/^suggested-stop: "/m);
      expect(content).toMatch(/^created: \d{4}-\d{2}-\d{2}$/m);
    });

    it('파일 경로 있는 실패는 file slug 사용', () => {
      const filePath = 'src/cli/foo.ts';
      const err = "TypeError: Cannot read properties of undefined";
      for (let i = 0; i < 3; i++) {
        runCounter({
          payload: {
            tool_name: 'Edit',
            tool_input: { file_path: filePath },
            tool_response: { is_error: true, error: err },
          },
          projectDir,
        });
      }
      const [filename] = listAntiPatterns(projectDir);
      expect(filename).toMatch(/^nullability__src-cli-foo-ts__\d{8}\.md$/);
    });

    it('윈도우 외 실패는 카운트 안 됨', () => {
      const err = "TypeError: Cannot read properties of undefined";
      // 같은 카테고리 실패 2회
      failBash('a', err, projectDir);
      failBash('b', err, projectDir);
      // 성공 툴콜로 윈도우 채움 (10줄 이상) — Bash 를 사용 (Read 는 조기 종료로 jsonl 미기록)
      for (let i = 0; i < 10; i++) {
        runCounter({
          payload: { tool_name: 'Bash', tool_input: { command: `echo ${i}` }, tool_response: {} },
          projectDir,
        });
      }
      // 마지막 실패 1회 — 윈도우(10줄) 안에는 이 실패 + 직전 성공만 있으므로 트립 안 함
      failBash('c', err, projectDir);
      expect(listAntiPatterns(projectDir)).toHaveLength(0);
    });
  });

  // ───────── 차단 금지 ─────────
  describe('hot path 안정성', () => {
    it('항상 exit 0', () => {
      const r = runCounter({
        payload: { tool_name: 'Bash', tool_input: { command: 'x' }, tool_response: {} },
        projectDir,
      });
      expect(r.status).toBe(0);
    });

    it('잘못된 stdin JSON 도 차단 안 함', () => {
      const r = spawnSync('node', [SCRIPT], {
        input: 'not json at all',
        encoding: 'utf-8',
        timeout: 5000,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      });
      expect(r.status).toBe(0);
    });
  });

  // ───────── 읽기 전용 도구 조기 종료 (defense-in-depth) ─────────
  describe('읽기 전용 도구 조기 종료', () => {
    const READ_ONLY = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite', 'ToolSearch', 'ListMcpResourcesTool'];

    it.each(READ_ONLY)('%s 호출 시 파일 미생성 + exit 0', (toolName) => {
      const r = runCounter({
        payload: { tool_name: toolName, tool_input: { file_path: 'src/foo.ts' }, tool_response: {} },
        projectDir,
      });
      expect(r.status).toBe(0);
      // jsonl에 기록하지 않아야 함
      const jsonlPath = path.join(projectDir, '.vibe', 'metrics', 'current-run.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
      // current-run.json 도 생성하지 않아야 함
      const jsonPath = path.join(projectDir, '.vibe', 'metrics', 'current-run.json');
      expect(fs.existsSync(jsonPath)).toBe(false);
    });
  });

  // ───────── 쓰기 스로틀 ─────────
  describe('쓰기 스로틀: jsonl 항상 append, json 조건부 재작성', () => {
    it('첫 번째 이벤트는 current-run.json 생성 (파일 없음 → 스로틀 없음)', () => {
      runCounter({
        payload: { tool_name: 'Bash', tool_input: { command: 'x' }, tool_response: {} },
        projectDir,
      });
      expect(fs.existsSync(runJson)).toBe(true);
      expect(readJson(runJson).steps).toBe(1);
    });

    it('10이벤트마다 강제 재작성: 10회 후 steps=jsonl라인수=10', () => {
      for (let i = 0; i < 10; i++) {
        runCounter({
          payload: { tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, tool_response: {} },
          projectDir,
        });
      }
      // 10번째 이벤트에서 강제 재작성 (10%10===0) — steps = jsonl 라인 수 = 10
      const data = readJson(runJson);
      expect(data.steps).toBe(10);
      // jsonl 도 10줄
      const lines = readJsonl(runJsonl);
      expect(lines).toHaveLength(10);
    });

    it('jsonl 은 스로틀 무관 항상 즉시 append', () => {
      for (let i = 0; i < 5; i++) {
        runCounter({
          payload: { tool_name: 'Bash', tool_input: { command: `cmd-${i}` }, tool_response: {} },
          projectDir,
        });
      }
      const lines = readJsonl(runJsonl);
      expect(lines).toHaveLength(5);
    });

    it('3-fail 감지는 jsonl 기반 — json 스로틀 후에도 동작', () => {
      const err = "TypeError: Cannot read properties of undefined (reading 'x')";
      // 3회 실패 (jsonl에 즉시 기록되므로 감지 가능)
      for (let i = 0; i < 3; i++) {
        runCounter({
          payload: {
            tool_name: 'Bash',
            tool_input: { command: `run-${i}` },
            tool_response: { is_error: true, error: err },
          },
          projectDir,
        });
      }
      const apDir = path.join(projectDir, '.vibe', 'anti-patterns');
      const files = fs.existsSync(apDir) ? fs.readdirSync(apDir).filter(f => f.endsWith('.md')) : [];
      expect(files).toHaveLength(1);
    });
  });
});
