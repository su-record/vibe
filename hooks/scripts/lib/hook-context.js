/**
 * Hook 실행 컨텍스트 공용 헬퍼 — in-process 평탄화의 기반.
 *
 * 훅 스크립트는 두 모드로 실행된다:
 *   1. in-process: 디스패처가 stdin을 1회 읽고 buildCtx()로 만든 ctx를
 *      각 스크립트의 run(ctx)에 직접 전달 (자식 spawn 없음)
 *   2. standalone CLI: antigravity-hooks.json / 기존 테스트가 스크립트를
 *      직접 실행 — isDirectRun()으로 감지해 stdin/argv/env에서 ctx를 구성
 *
 * ctx 형태: { toolName, toolInput, payload, hookInput, filePath }
 *   - toolName: payload.tool_name 우선, argv 폴백 (현행 각 스크립트와 동일 우선순위)
 *   - toolInput: 문자열 정규화된 tool_input (payload → argv[3] → env.TOOL_INPUT)
 *   - payload: 파싱된 stdin JSON 또는 null
 *   - hookInput: stdin 원문 문자열 (code-check의 HOOK_INPUT 사용처 대체)
 *   - filePath: toolInput 에서 뽑은 대상 파일 경로 (file_path → notebook_path →
 *     path 우선순위 — 각 스크립트의 인라인 추출 로직과 동일 규약)
 */
import fs from 'fs';
import { pathToFileURL } from 'url';

/** stdin을 EOF까지 읽을 때 허용하는 최대 바이트 수 (10MB). */
const STDIN_MAX_BYTES = 10 * 1024 * 1024;

/** EAGAIN 재시도 간격/데드라인 — non-blocking pipe에서 writer가 아직 flush 전일 수 있다. */
const STDIN_EAGAIN_RETRY_MS = 5;
const STDIN_EAGAIN_DEADLINE_MS = 500;

/** 동기 sleep (Atomics.wait — 이벤트 루프 없이 대기). */
const sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(sleepBuf, 0, 0, ms);
}

/** 누적 청크가 완전한 JSON인지 검사 — EAGAIN 시 조기 종료 판단용. */
function isCompleteJson(chunks) {
  try {
    JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * stdin에서 JSON 페이로드 동기 읽기 (Claude Code 하네스 호환).
 * fd 0 직접 사용 — Windows는 '/dev/stdin'이 없음.
 * 64KB 단일 버퍼 대신 EOF까지 청크 반복 읽기 (STDIN_MAX_BYTES 상한).
 *
 * @returns {{ raw: string|null, parsed: object|null, truncated: boolean }}
 *   truncated=true: 페이로드가 STDIN_MAX_BYTES를 초과해 잘림
 */
export function readStdinSync() {
  try {
    if (process.stdin.isTTY) return { raw: null, parsed: null, truncated: false };

    const chunks = [];
    let totalBytes = 0;
    let truncated = false;
    const chunkSize = 65536;
    const chunkBuf = Buffer.alloc(chunkSize);

    let lastProgress = Date.now();
    while (true) {
      let bytesRead;
      try {
        bytesRead = fs.readSync(0, chunkBuf, 0, chunkSize, null);
      } catch (err) {
        // EAGAIN: 파이프가 *지금* 비었을 뿐 EOF가 아닐 수 있다 (writer가 flush 전).
        // EOF로 취급하면 대용량 페이로드가 중간에 끊겨 가드가 fail-open된다 —
        // 완전한 JSON이 모였거나 데드라인이 지나기 전까지 재시도한다.
        if (err.code === 'EAGAIN') {
          if (chunks.length > 0 && isCompleteJson(chunks)) break;
          if (Date.now() - lastProgress > STDIN_EAGAIN_DEADLINE_MS) break;
          sleepSync(STDIN_EAGAIN_RETRY_MS);
          continue;
        }
        throw err;
      }
      if (bytesRead === 0) break;
      lastProgress = Date.now();
      totalBytes += bytesRead;
      if (totalBytes > STDIN_MAX_BYTES) {
        truncated = true;
        break;
      }
      chunks.push(Buffer.from(chunkBuf.subarray(0, bytesRead)));
    }

    if (chunks.length === 0) return { raw: null, parsed: null, truncated: false };

    const raw = Buffer.concat(chunks).toString('utf-8');
    try {
      return { raw, parsed: JSON.parse(raw), truncated };
    } catch {
      return { raw, parsed: null, truncated };
    }
  } catch { /* stdin 없음 → 폴백 */ }
  return { raw: null, parsed: null, truncated: false };
}

/**
 * toolInput(문자열화된 JSON)에서 대상 파일 경로 추출.
 * 각 훅 스크립트의 인라인 추출과 동일 우선순위: file_path → notebook_path → path.
 * @param {string} toolInput
 * @returns {string}
 */
function extractFilePath(toolInput) {
  try {
    const parsed = JSON.parse(toolInput || '{}');
    return parsed.file_path || parsed.notebook_path || parsed.path || '';
  } catch {
    return '';
  }
}

/**
 * 실행 컨텍스트 구성. 우선순위는 현행 스크립트들과 동일:
 *   toolName: payload.tool_name → argvToolName
 *   toolInput: payload.tool_input(문자열화) → argv[3] → env.TOOL_INPUT
 */
export function buildCtx({ rawInput = null, payload = null, argvToolName = '', argvToolInput = '' } = {}) {
  const toolName = payload?.tool_name || argvToolName || '';
  const toolInput = payload?.tool_input !== undefined && payload?.tool_input !== null
    ? (typeof payload.tool_input === 'string' ? payload.tool_input : JSON.stringify(payload.tool_input))
    : (argvToolInput || process.env.TOOL_INPUT || '');
  return { toolName, toolInput, payload, hookInput: rawInput, filePath: extractFilePath(toolInput) };
}

/** standalone CLI 모드용 ctx — stdin/argv/env에서 구성 */
export function buildCliCtx() {
  const { raw, parsed } = readStdinSync();
  return buildCtx({
    rawInput: raw ?? process.env.HOOK_INPUT ?? null,
    payload: parsed,
    argvToolName: process.argv[2] || '',
    argvToolInput: process.argv[3] || '',
  });
}

/** 모듈이 `node <file>`로 직접 실행됐는지 감지 (import 시 false) */
export function isDirectRun(importMetaUrl) {
  try {
    return Boolean(process.argv[1]) && importMetaUrl === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}
