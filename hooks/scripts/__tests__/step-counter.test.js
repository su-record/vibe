/**
 * step-counter.js — Phase 1 테스트
 *
 * 검증 범위:
 *  - 책임 1) current-run.json steps 증가 (회귀 테스트)
 *  - 책임 2) current-run.jsonl append (스키마/정규화/누적)
 *  - 두 책임의 독립성 + hot-path 차단 금지
 *
 * 패턴: keyword-detector.test.js 와 동일한 spawnSync 방식.
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
    },
  });
  return result;
}

function makeTmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-step-counter-'));
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

    it('연속 호출 시 steps 누적', () => {
      for (let i = 0; i < 3; i++) {
        runCounter({
          payload: { tool_name: 'Bash', tool_input: { command: 'echo hi' }, tool_response: {} },
          projectDir,
        });
      }
      const data = readJson(runJson);
      expect(data.steps).toBe(3);
    });

    it('손상된 JSON 이 있어도 새로 시작', () => {
      fs.mkdirSync(path.join(projectDir, '.vibe', 'metrics'), { recursive: true });
      fs.writeFileSync(runJson, '{ broken json');
      const r = runCounter({
        payload: { tool_name: 'Bash', tool_input: {}, tool_response: {} },
        projectDir,
      });
      expect(r.status).toBe(0);
      const data = readJson(runJson);
      expect(data.steps).toBe(1);
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

    it('연속 호출 시 jsonl 누적', () => {
      runCounter({
        payload: { tool_name: 'Read', tool_input: { file_path: 'a.ts' }, tool_response: {} },
        projectDir,
      });
      runCounter({
        payload: { tool_name: 'Edit', tool_input: { file_path: 'a.ts' }, tool_response: {} },
        projectDir,
      });
      const lines = readJsonl(runJsonl);
      expect(lines).toHaveLength(2);
      expect(lines.map((l) => l.tool)).toEqual(['Read', 'Edit']);
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
});
