#!/usr/bin/env node
/**
 * dispatch() 를 실제 계약대로 (CLI spawn + stdin) 구동하는 테스트 하네스.
 * 스텝 3개를 dispatch 에 넘기고, 각 스텝은 seq-step.js 가 트레이스를 남긴다.
 */
import { dispatch } from '../../lib/dispatcher.js';

await dispatch([
  { name: 'seq-a', script: '__tests__/fixtures/seq-step.js', args: ['a'] },
  { name: 'seq-b', script: '__tests__/fixtures/seq-step.js', args: ['b'] },
  { name: 'seq-c', script: '__tests__/fixtures/seq-step.js', args: ['c'] },
]);
process.exit(0);
