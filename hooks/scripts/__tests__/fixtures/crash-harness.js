#!/usr/bin/env node
/**
 * guard 크래시 처리 회귀 테스트용 하네스 (REQ-audit-p2-remediation-005).
 *
 * argv[2] 로 크래시 대상을 고른다:
 *   deny-guard  — denyOnExit2 를 가진 guard 가 throw
 *   plain-step  — deny 권한 없는 step 이 throw
 *   none        — 아무도 throw 하지 않음 (정상 경로 대조군)
 */
import { dispatchInProcess } from '../../lib/dispatcher.js';

const mode = process.argv[2] || 'none';
const boom = async () => { throw new Error('boom'); };

const steps = [];
if (mode === 'deny-guard') {
  steps.push({ name: 'crashing-guard', denyOnExit2: true, run: boom });
} else if (mode === 'plain-step') {
  steps.push({ name: 'crashing-log', run: boom });
}
steps.push({ name: 'healthy-step', run: async () => 0 });

await dispatchInProcess(steps, { argvToolName: 'Edit' });
process.exit(0);
