/**
 * loop-ledger 라이브러리 + CLI 테스트
 *
 * 커버리지:
 * - appendLoopEvent round-trip
 * - isStuck: 2회 연속 동일 hash → true
 * - isStuck: 다른 hash → false
 * - isStuck: 이력 없음 → false
 * - fail-open: 손상된 jsonl 줄 무시
 * - hashDiscoverOutput: 공백 정규화
 * - CLI: start / end / check-stuck 서브커맨드
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-loop-ledger-test-'));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

async function importLedger() {
  const p = path.resolve(__dirname, '..', 'lib', 'loop-ledger.js');
  return import(p);
}

const CLI = path.resolve(__dirname, '..', 'loop-ledger.js');

function historyPath(dir) {
  return path.join(dir, '.vibe', 'metrics', 'loop-history.jsonl');
}

// ─── appendLoopEvent round-trip ───────────────────────────────────────

describe('loop-ledger: appendLoopEvent round-trip', () => {
  it('start 이벤트를 append 하면 jsonl 파일에 기록된다', async () => {
    const { appendLoopEvent } = await importLedger();
    appendLoopEvent(tmpDir, { loop: 'nightly', event: 'start' });

    const p = historyPath(tmpDir);
    expect(fs.existsSync(p)).toBe(true);
    const line = fs.readFileSync(p, 'utf-8').trim();
    const obj = JSON.parse(line);
    expect(obj.loop).toBe('nightly');
    expect(obj.event).toBe('start');
    expect(obj.ts).toBeDefined();
  });

  it('end 이벤트에 result, summary, discoverHash가 포함된다', async () => {
    const { appendLoopEvent } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'end',
      result: 'ok',
      summary: '3 items processed',
      discoverHash: 'abc123',
    });

    const p = historyPath(tmpDir);
    const line = fs.readFileSync(p, 'utf-8').trim();
    const obj = JSON.parse(line);
    expect(obj.event).toBe('end');
    expect(obj.result).toBe('ok');
    expect(obj.summary).toBe('3 items processed');
    expect(obj.discoverHash).toBe('abc123');
  });

  it('여러 이벤트가 순서대로 append 된다', async () => {
    const { appendLoopEvent } = await importLedger();
    appendLoopEvent(tmpDir, { loop: 'loop-a', event: 'start' });
    appendLoopEvent(tmpDir, { loop: 'loop-a', event: 'end', result: 'ok' });
    appendLoopEvent(tmpDir, { loop: 'loop-b', event: 'start' });

    const p = historyPath(tmpDir);
    const lines = fs.readFileSync(p, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).loop).toBe('loop-a');
    expect(JSON.parse(lines[1]).event).toBe('end');
    expect(JSON.parse(lines[2]).loop).toBe('loop-b');
  });

  it('appendLoopEvent는 true를 반환한다', async () => {
    const { appendLoopEvent } = await importLedger();
    const result = appendLoopEvent(tmpDir, { loop: 'x', event: 'start' });
    expect(result).toBe(true);
  });
});

// ─── isStuck ──────────────────────────────────────────────────────────

describe('loop-ledger: isStuck', () => {
  it('이력 없으면 false', async () => {
    const { isStuck } = await importLedger();
    expect(isStuck(tmpDir, 'nightly', 'hash-abc')).toBe(false);
  });

  it('직전 discover 이벤트와 동일 hash → true (2회 연속 성립)', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();
    // 이전 반복의 discover 이벤트 (같은 hash)
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'discover',
      discoverHash: 'hash-same',
    });
    // 신규 반복이 같은 hash를 갖고 오면 stuck
    expect(isStuck(tmpDir, 'nightly', 'hash-same')).toBe(true);
  });

  it('직전 discover 이벤트와 다른 hash → false', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'discover',
      discoverHash: 'hash-old',
    });
    expect(isStuck(tmpDir, 'nightly', 'hash-new')).toBe(false);
  });

  it('end 이벤트의 hash는 비교 대상이 아님 (discover만 본다)', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'end',
      result: 'ok',
      discoverHash: 'hash-same',
    });
    expect(isStuck(tmpDir, 'nightly', 'hash-same')).toBe(false);
  });

  it('다른 루프 이름의 이벤트는 영향 안 줌', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'other-loop',
      event: 'discover',
      discoverHash: 'hash-same',
    });
    // 'nightly' 에 대한 이력 없음 → false
    expect(isStuck(tmpDir, 'nightly', 'hash-same')).toBe(false);
  });

  it('start 이벤트만 있고 discover 없으면 false', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();
    appendLoopEvent(tmpDir, { loop: 'nightly', event: 'start' });
    expect(isStuck(tmpDir, 'nightly', 'hash-abc')).toBe(false);
  });

  it('discoverHash 가 빈 문자열이면 false', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'discover',
      discoverHash: '',
    });
    expect(isStuck(tmpDir, 'nightly', '')).toBe(false);
  });
});

// ─── fail-open: 손상된 jsonl 줄 ──────────────────────────────────────

describe('loop-ledger: fail-open on corrupt jsonl', () => {
  it('손상된 줄이 있어도 isStuck이 충돌하지 않고 false 반환', async () => {
    const { appendLoopEvent, isStuck } = await importLedger();

    // 정상 줄 + 손상 줄 + 정상 줄 혼합
    const p = historyPath(tmpDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
      p,
      [
        JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', loop: 'nightly', event: 'discover', discoverHash: 'abc' }),
        'CORRUPTED LINE {{{',
        JSON.stringify({ ts: '2026-01-01T01:00:00.000Z', loop: 'nightly', event: 'discover', discoverHash: 'xyz' }),
      ].join('\n') + '\n',
      'utf-8'
    );

    // 손상 줄은 건너뛰고, 가장 최근 discover 이벤트(최신)의 hash는 'xyz'
    expect(isStuck(tmpDir, 'nightly', 'xyz')).toBe(true);
    expect(isStuck(tmpDir, 'nightly', 'abc')).toBe(false);
  });

  it('appendLoopEvent: 전체 파일이 corrupt 여도 추가 후 정상 동작', async () => {
    const { appendLoopEvent } = await importLedger();
    const p = historyPath(tmpDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'NOT JSON\n', 'utf-8');

    const ok = appendLoopEvent(tmpDir, { loop: 'x', event: 'start' });
    expect(ok).toBe(true);
    const lines = fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
    // 손상 줄 + 새로 추가된 정상 줄
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.event).toBe('start');
  });
});

// ─── hashDiscoverOutput ───────────────────────────────────────────────

describe('loop-ledger: hashDiscoverOutput', () => {
  it('동일 텍스트는 동일 해시를 반환한다', async () => {
    const { hashDiscoverOutput } = await importLedger();
    const h1 = hashDiscoverOutput('hello world');
    const h2 = hashDiscoverOutput('hello world');
    expect(h1).toBe(h2);
  });

  it('공백 정규화: 여분 공백/줄바꿈이 달라도 동일 해시', async () => {
    const { hashDiscoverOutput } = await importLedger();
    const h1 = hashDiscoverOutput('item a\nitem b');
    const h2 = hashDiscoverOutput('item a  item b');
    const h3 = hashDiscoverOutput('  item a item b  ');
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('다른 텍스트는 다른 해시', async () => {
    const { hashDiscoverOutput } = await importLedger();
    expect(hashDiscoverOutput('abc')).not.toBe(hashDiscoverOutput('xyz'));
  });

  it('sha256 hex 64자 반환', async () => {
    const { hashDiscoverOutput } = await importLedger();
    expect(hashDiscoverOutput('test')).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── CLI: start / end / check-stuck ─────────────────────────────────

describe('loop-ledger CLI', () => {
  it('start → exit 0, 확인 메시지 출력, jsonl 생성', () => {
    const result = spawnSync('node', [CLI, 'start', 'nightly'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('start recorded');
    expect(result.stdout).toContain('nightly');
    expect(fs.existsSync(historyPath(tmpDir))).toBe(true);
  });

  it('end → exit 0, jsonl에 end 이벤트 기록', () => {
    const result = spawnSync('node', [CLI, 'end', 'nightly', 'ok', 'summary text'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('end recorded');

    const line = fs.readFileSync(historyPath(tmpDir), 'utf-8').trim();
    const obj = JSON.parse(line);
    expect(obj.event).toBe('end');
    expect(obj.result).toBe('ok');
    expect(obj.summary).toBe('summary text');
  });

  it('check-stuck: 직전 discover hash와 동일 → stdout "stuck"', async () => {
    const { appendLoopEvent } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'discover',
      discoverHash: 'deadbeef',
    });

    const result = spawnSync('node', [CLI, 'check-stuck', 'nightly', 'deadbeef'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('stuck');
  });

  it('check-stuck: 새 hash → stdout "ok"', async () => {
    const { appendLoopEvent } = await importLedger();
    appendLoopEvent(tmpDir, {
      loop: 'nightly',
      event: 'end',
      result: 'ok',
      discoverHash: 'old-hash',
    });

    const result = spawnSync('node', [CLI, 'check-stuck', 'nightly', 'new-hash'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });

  it('check-stuck: 이력 없으면 "ok"', () => {
    const result = spawnSync('node', [CLI, 'check-stuck', 'nightly', 'anyhash'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });

  it('인수 없이 실행해도 exit 0 (fail-open)', () => {
    const result = spawnSync('node', [CLI], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
  });
});
