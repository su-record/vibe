#!/usr/bin/env node
/**
 * Codex 플러그인 감지 유틸
 *
 * 워크플로우 스킬(.md)에서 Bash로 호출하여 Codex 사용 가능 여부 확인.
 *
 * 사용법 (스킬 마크다운에서):
 *   node {{VIBE_PATH}}/hooks/scripts/codex-detect.js
 *
 * 출력:
 *   "available" — Codex CLI 설치 + auth 존재
 *   "unavailable" — 미설치 또는 미인증
 *
 * 종료 코드:
 *   0 — available
 *   1 — unavailable
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const codexDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');

// CLI 설치 확인
let cliInstalled = fs.existsSync(codexDir);
if (!cliInstalled) {
  try {
    execSync('which codex', { stdio: 'ignore' });
    cliInstalled = true;
  } catch {
    // not found
  }
}

// 인증 확인
const authExists = fs.existsSync(path.join(codexDir, 'auth.json'));

if (cliInstalled && authExists) {
  console.log('available');
  process.exit(0);
} else {
  console.log('unavailable');
  process.exit(1);
}
