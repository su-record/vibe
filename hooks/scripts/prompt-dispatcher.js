#!/usr/bin/env node
/**
 * UserPromptSubmit 디스패처
 *
 * UserPromptSubmit은 matcher를 지원하지 않아 모든 hook이 매번 실행됨.
 * 이 디스패처가 stdin에서 prompt를 읽고, 패턴 매칭 후 해당 스크립트만 실행.
 *
 * 이점:
 * - 외부 LLM 호출(GPT/Antigravity)이 패턴 매칭 없이 발동하지 않음
 * - context window에 불필요한 응답이 주입되지 않음
 * - 단일 프로세스에서 매칭 후 필요한 스크립트만 fork
 */
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 하네스 노이즈 억제 — 비동기 체인/setImmediate 내부에서 unhandledRejection이 발생해도
// UserPromptSubmit 훅이 "failed (exit 1)"로 표시되지 않도록 한다.
process.on('unhandledRejection', () => { /* swallow */ });
process.on('uncaughtException', () => { /* swallow */ });

// 재귀 가드 — 자식 Claude 세션에서 이 hook이 다시 실행되는 것 차단.
// llm-orchestrate.js의 callClaudeCli가 VIBE_HOOK_DEPTH=1을 주입하므로,
// 값이 있으면 즉시 종료해 프로세스 폭탄을 막는다.
if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

// stdin에서 prompt 읽기
let inputData = '';
for await (const chunk of process.stdin) {
  inputData += chunk;
}

let prompt = '';
try {
  const parsed = JSON.parse(inputData);
  prompt = parsed.prompt || '';
} catch {
  process.exit(0);
}

if (!prompt) process.exit(0);

// vibe.run 감지 — runStarted 기록 및 verifyPassed 리셋 (in-process, stdout 없음).
{
  const { isVibeRunPrompt, extractRunFeature, recordRunStart } = await import('./lib/run-ledger.js');
  if (isVibeRunPrompt(prompt)) {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const feature = extractRunFeature(prompt);
    recordRunStart(projectDir, feature);
  }
}

// 레거시 SSOT 통합 — `/vibe.*` 진입 시 `.claude/vibe/` → `.vibe/` 자동 이동.
// `vibe init`/`update` 와 동일한 `consolidateLegacyVibe` (dist/cli/setup/LegacyMigration.js) 를 직접 재사용. Idempotent.
if (/^\s*\/vibe\b/i.test(prompt)) {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const utils = await import('./utils.js');
    const CLI_BASE = utils.getCliBaseUrl();
    const { consolidateLegacyVibe } = await import(`${CLI_BASE}setup/LegacyMigration.js`);
    const moved = consolidateLegacyVibe(projectDir);
    if (moved.length > 0) {
      process.stdout.write(`[vibe] Migrated legacy dirs → .vibe/ (${moved.join(', ')})\n`);
    }
  } catch { /* migration is best-effort */ }
}

// 패턴 → 실행할 스크립트 매핑
// 각 항목: { pattern, script, args, label }
// (참고: 매직 키워드 배너 주입(keyword-detector)은 제거됨 — deprecated 별칭
//  매핑은 CLAUDE.md 의 "Deprecated aliases" 표가 SSOT이며 모델이 직접 해석한다.)
const DISPATCH_RULES = [
  // echo 전용 (stdout으로 직접 출력)
  {
    pattern: /e2e.*테스트|e2e.*test|playwright|브라우저.*테스트|browser.*test/i,
    script: null,
    echo: '[E2E MODE] Use /vibe.utils --e2e for Playwright-based browser testing. Supports visual regression and video recording.',
    label: 'e2e-echo',
  },

  // 외부 LLM 호출 (GPT/Antigravity) — 명시적 provider 접두사 필수.
  //
  // 과거에는 "추론해", "코드 리뷰", "디버깅해" 같은 자연어 패턴이 prompt
  // 어디서든 매칭되어, 평범한 한국어/영어 요청에도 외부 LLM이 동기로 spawn되고
  // 그 응답이 컨텍스트에 주입되었다(컨텍스트 오염 + 최대 30s 블로킹).
  // 이제는 prompt가 `gpt`/`agy`/`antigravity` 로 **시작**할 때만 발동한다.
  // 즉 사용자가 외부 LLM을 콕 집어 부를 때만 동작하고, 일상 요청엔 걸리지 않는다.
  // (참고: `/vibe.reason` 스킬이 일반 추론을 담당하므로 자연어 자동호출은 불필요)
  // `s` 플래그(dotAll)로 여러 줄 prompt 의 역할 키워드도 매칭한다.
  {
    pattern: /^\s*gpt\b.*(아키텍처|architecture|설계|구조)/is,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a software architect. Analyze and review the architecture.'],
    label: 'gpt-architecture',
  },
  {
    pattern: /^\s*(agy|antigravity)\b.*(ui|ux|디자인|design|사용자.*경험)/is,
    script: 'llm-orchestrate.js',
    args: ['antigravity', 'orchestrate', 'You are a UI/UX expert. Analyze and provide feedback.'],
    label: 'antigravity-uiux',
  },
  {
    pattern: /^\s*gpt\b.*(디버깅|debug|버그|bug)/is,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a debugging expert. Find bugs and suggest fixes.'],
    label: 'gpt-debug',
  },
  {
    pattern: /^\s*(agy|antigravity)\b.*(분석|analyz|코드.*품질|code.*quality)/is,
    script: 'llm-orchestrate.js',
    args: ['antigravity', 'orchestrate', 'You are a code analysis expert. Review and analyze the code.'],
    label: 'antigravity-analysis',
  },
  {
    pattern: /^\s*gpt\b.*(리뷰|review)/is,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a code review expert. Review the code for best practices, security, and performance.'],
    label: 'gpt-codereview',
  },
  {
    pattern: /^\s*gpt\b.*(추론|reasoning|복잡.*분석|deep.*analysis)/is,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a reasoning expert. Analyze the problem deeply and provide detailed reasoning.'],
    label: 'gpt-reasoning',
  },

  // 테스트용
  {
    pattern: /^test-gpt/i,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a helpful assistant. Answer the user\'s question clearly and concisely.'],
    label: 'test-gpt',
  },
  {
    pattern: /^test-(antigravity|agy)/i,
    script: 'llm-orchestrate.js',
    args: ['antigravity', 'orchestrate', 'You are a helpful assistant. Answer the user\'s question clearly and concisely.'],
    label: 'test-antigravity',
  },
];

// 매칭된 스크립트 실행
const execPromises = [];

for (const rule of DISPATCH_RULES) {
  if (rule.label === 'skip') continue;

  // pattern이 null이면 항상 실행, 아니면 매칭 확인
  if (rule.pattern !== null && !rule.pattern.test(prompt)) continue;

  // echo 규칙: 직접 stdout 출력
  if (rule.echo) {
    process.stdout.write(rule.echo + '\n');
    continue;
  }

  if (!rule.script) continue;

  const scriptPath = path.join(__dirname, rule.script);
  const args = rule.args || [];

  // 외부 LLM 호출(llm-orchestrate)은 부모/자식 timeout 을 정합시킨다 (B-2):
  // 자식은 hook 모드(primary 45s, fallback 없음, retry 없음)로 단일 시도 후 스스로
  // 정리하고, 부모는 그보다 약간 긴 50s 로 감싸 hard-kill 을 피한다.
  // 경량 스크립트는 기존 30s 유지.
  const isLlm = rule.script === 'llm-orchestrate.js';
  const execTimeout = isLlm ? 50000 : 30000;
  const childEnv = isLlm
    ? { ...process.env, VIBE_LLM_HOOK_MODE: '1', VIBE_LLM_PRIMARY_TIMEOUT_MS: '45000', VIBE_LLM_MAX_RETRIES: '1' }
    : { ...process.env };

  execPromises.push(
    new Promise((resolve) => {
      execFile('node', [scriptPath, ...args], {
        timeout: execTimeout,
        env: childEnv,
      }, (error, stdout, stderr) => {
        if (stdout?.trim()) {
          process.stdout.write(stdout);
        } else if (error) {
          // 무음실패 방지 — 외부 LLM 호출이 timeout 또는 에러로 결과 없이 죽을 때,
          // 사용자가 원인을 알 수 있도록 한 줄만 노출한다.
          const reason = error.killed ? `timed out (${execTimeout / 1000}s)` : (error.message || 'failed');
          process.stdout.write(`[${rule.label}] external LLM call ${reason} — no result injected.\n`);
        }
        resolve();
      });
    })
  );
}

await Promise.all(execPromises);

// Evolution: Gap detection — log unmatched prompts for skill gap analysis
const matched = DISPATCH_RULES.some(r =>
  r.pattern !== null && r.pattern.test(prompt) &&
  (r.script || r.echo)
);

if (!matched) {
  setImmediate(async () => {
    try {
      const utils = await import('./utils.js');
      const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
      const configPath = utils.projectVibePath(projectDir, 'config.json');
      let gapEnabled = true;
      try {
        const fs = await import('fs');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          gapEnabled = config.evolution?.gapDetection !== false && config.evolution?.enabled !== false;
        }
      } catch { /* ignore */ }

      if (gapEnabled) {
        const LIB_BASE = utils.getLibBaseUrl();
        const [memMod, gapMod] = await Promise.all([
          import(`${LIB_BASE}memory/MemoryStorage.js`),
          import(`${LIB_BASE}evolution/SkillGapDetector.js`),
        ]);
        const storage = new memMod.MemoryStorage(projectDir);
        const detector = new gapMod.SkillGapDetector(storage);
        detector.logMiss(prompt.slice(0, 200));
        storage.close();
      }
    } catch (e) {
      process.stderr.write(`[Evolution] Gap log error: ${e.message}\n`);
    }
  });
}

// 명시적 성공 종료 — 하네스에 exit 1로 비치지 않도록.
process.exit(0);
