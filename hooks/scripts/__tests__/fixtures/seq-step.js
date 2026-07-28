#!/usr/bin/env node
/**
 * dispatch() 순차 실행 회귀 테스트용 스텝 픽스처.
 *
 * 실행 구간의 시작/끝을 VIBE_SEQ_TRACE 파일에 append 한다.
 * 순차 실행이면 트레이스는 `a:start,a:end,b:start,b:end` 처럼 구간이 겹치지 않고,
 * 병렬 실행이면 `a:start,b:start,...` 로 인터리빙된다.
 */
import fs from 'fs';

const name = process.argv[2] || '?';
const tracePath = process.env.VIBE_SEQ_TRACE;
const holdMs = Number(process.env.VIBE_SEQ_HOLD_MS || 120);

fs.appendFileSync(tracePath, `${name}:start\n`);

// 동기 홀드 — 병렬 실행 시 다른 스텝의 start 가 이 구간 안에 끼어들도록 만든다.
const until = Date.now() + holdMs;
while (Date.now() < until) { /* busy wait */ }

fs.appendFileSync(tracePath, `${name}:end\n`);
process.exit(0);
