#!/usr/bin/env node
/**
 * PostToolUse Hook - 툴콜 스텝 카운터
 *
 * 목적: vibe 멀티-오케스트레이션의 "목표 달성까지 몇 스텝" 측정.
 *       모든 성공 툴콜을 1 스텝으로 집계하여 `/vibe.verify` 리포트에 노출.
 *
 * 저장 위치: .claude/vibe/metrics/current-run.json
 *   - /vibe.run 시작 시 overwrite (feature, startedAt, steps=0)
 *   - 이후 툴콜마다 steps += 1
 *   - /vibe.verify가 읽어서 history.jsonl에 append 후 출력
 *
 * 실패 시 조용히 통과 (차단 금지).
 */
import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, projectVibePath } from './utils.js';

const METRICS_DIR = projectVibePath(PROJECT_DIR, 'metrics');
const CURRENT_RUN = path.join(METRICS_DIR, 'current-run.json');

try {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  let data = { feature: null, startedAt: null, steps: 0 };
  if (fs.existsSync(CURRENT_RUN)) {
    try {
      data = JSON.parse(fs.readFileSync(CURRENT_RUN, 'utf-8'));
    } catch {
      // 손상 파일 무시, 새로 시작
    }
  }

  if (!data.startedAt) {
    data.startedAt = new Date().toISOString();
  }
  data.steps = (data.steps || 0) + 1;

  fs.writeFileSync(CURRENT_RUN, JSON.stringify(data, null, 2));
} catch {
  // Never block on counter failure
}
process.exit(0);
