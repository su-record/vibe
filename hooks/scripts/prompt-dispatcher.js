#!/usr/bin/env node
/**
 * UserPromptSubmit 디스패처
 *
 * UserPromptSubmit은 matcher를 지원하지 않아 모든 hook이 매번 실행됨.
 * 이 디스패처가 stdin에서 prompt를 읽고, 패턴 매칭 후 해당 스크립트만 실행.
 *
 * 이점:
 * - 외부 LLM 호출(GPT/Gemini)이 패턴 매칭 없이 발동하지 않음
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

// 패턴 → 실행할 스크립트 매핑
// 각 항목: { pattern, script, args, label }
const DISPATCH_RULES = [
  // 항상 실행 (경량 스크립트)
  {
    pattern: null, // always
    script: 'keyword-detector.js',
    args: [prompt],
    label: 'keyword',
  },

  // 패턴 매칭이 필요한 스크립트
  {
    pattern: /ultrawork|ulw|울트라워크|ralph|ralplan/i,
    script: null, // keyword-detector가 이미 처리
    label: 'skip',
  },
  // echo 전용 (stdout으로 직접 출력)
  {
    pattern: /e2e.*테스트|e2e.*test|playwright|브라우저.*테스트|browser.*test/i,
    script: null,
    echo: '[E2E MODE] Use /vibe.utils --e2e for Playwright-based browser testing. Supports visual regression and video recording.',
    label: 'e2e-echo',
  },

  // 외부 LLM 호출 (GPT/Gemini) - 패턴 매칭 필수
  {
    pattern: /아키텍처.*(검토|리뷰|분석)|architecture.*(review|analyz)|설계.*검토|구조.*분석.*해/i,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a software architect. Analyze and review the architecture.'],
    label: 'gpt-architecture',
  },
  {
    pattern: /(UI|UX).*(리뷰|검토|피드백|개선)|사용자.*경험.*검토|디자인.*리뷰|design.*feedback/i,
    script: 'llm-orchestrate.js',
    args: ['gemini', 'orchestrate', 'You are a UI/UX expert. Analyze and provide feedback.'],
    label: 'gemini-uiux',
  },
  {
    pattern: /디버깅.*해|버그.*찾아|find.*bug|debug.*this.*code/i,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a debugging expert. Find bugs and suggest fixes.'],
    label: 'gpt-debug',
  },
  {
    pattern: /코드.*정적.*분석|코드.*분석.*해줘|analyze.*code.*quality/i,
    script: 'llm-orchestrate.js',
    args: ['gemini', 'orchestrate', 'You are a code analysis expert. Review and analyze the code.'],
    label: 'gemini-analysis',
  },
  {
    pattern: /코드.*리뷰|code.*review|PR.*리뷰|리뷰.*해줘.*코드/i,
    script: 'llm-orchestrate.js',
    args: ['gpt', 'orchestrate', 'You are a code review expert. Review the code for best practices, security, and performance.'],
    label: 'gpt-codereview',
  },
  {
    pattern: /추론.*해|reasoning|복잡.*분석|deep.*analysis/i,
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
    pattern: /^test-gemini/i,
    script: 'llm-orchestrate.js',
    args: ['gemini', 'orchestrate', 'You are a helpful assistant. Answer the user\'s question clearly and concisely.'],
    label: 'test-gemini',
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

  execPromises.push(
    new Promise((resolve) => {
      execFile('node', [scriptPath, ...args], {
        timeout: 30000,
        env: { ...process.env },
      }, (error, stdout, stderr) => {
        if (stdout?.trim()) {
          process.stdout.write(stdout);
        }
        resolve();
      });
    })
  );
}

await Promise.all(execPromises);

// Evolution: Gap detection — log unmatched prompts for skill gap analysis
const matched = DISPATCH_RULES.some(r =>
  r.label !== 'skip' && r.label !== 'keyword' &&
  r.pattern !== null && r.pattern.test(prompt) &&
  (r.script || r.echo)
);

if (!matched) {
  setImmediate(async () => {
    try {
      const utils = await import('./utils.js');
      const projectDir = process.env.CLAUDE_PROJECT_DIR || process.env.COCO_PROJECT_DIR || '.';
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
