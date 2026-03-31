#!/usr/bin/env node
/**
 * Codex Review Gate — Stop 훅에서 자동 실행
 *
 * Claude Code 작업 완료(Stop) 시 Codex 플러그인이 설치되어 있으면
 * /codex:review를 자동 트리거하여 최종 코드 리뷰 게이트 역할.
 *
 * 동작 조건:
 * - Codex 플러그인 설치됨 (which codex 또는 ~/.codex/ 존재)
 * - Stop 이벤트가 코드 변경을 포함 (Write/Edit 도구 사용됨)
 * - config.json에서 codexReviewGate가 비활성화되지 않음
 *
 * 출력:
 * - stdout로 Claude에게 /codex:review 호출 지시
 * - 조건 미충족 시 빈 출력 (스킵)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// stdin 읽기
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

// Codex CLI/플러그인 설치 여부 확인
function isCodexAvailable() {
  const codexDir = path.join(os.homedir(), '.codex');
  if (fs.existsSync(codexDir)) return true;

  try {
    execSync('which codex', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 프로젝트 config에서 codexReviewGate 설정 확인
function isCodexReviewGateEnabled() {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (!fs.existsSync(configPath)) return true; // 기본: 활성화
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // 명시적으로 false일 때만 비활성화
    return config.codexReviewGate !== false;
  } catch {
    return true;
  }
}

// Stop 이벤트에 코드 변경이 포함되었는지 확인
function hasCodeChanges() {
  try {
    const parsed = JSON.parse(input);
    const toolUses = parsed.tool_uses || parsed.tools_used || [];

    // Write 또는 Edit 도구가 사용되었으면 코드 변경 있음
    if (Array.isArray(toolUses)) {
      return toolUses.some(t => {
        const name = t.tool || t.name || '';
        return name === 'Write' || name === 'Edit';
      });
    }

    // 파싱 실패 시 항상 실행 (안전한 방향)
    return true;
  } catch {
    // stdin 파싱 실패 시 항상 실행
    return true;
  }
}

// 메인 로직
if (isCodexAvailable() && isCodexReviewGateEnabled() && hasCodeChanges()) {
  console.log('[CODEX REVIEW GATE] Run /codex:review for final code review before completing.');
}
