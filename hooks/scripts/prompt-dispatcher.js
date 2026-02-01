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
  {
    pattern: /버그.*(해결|수정|고침)|문제.*(해결|수정)|bug.*(fixed|resolved|solved)|issue.*(fixed|resolved)|PR.*(merged|머지)/i,
    script: 'compound.js',
    args: [],
    label: 'compound',
  },
  {
    pattern: /코드\s*리뷰|code\s*review|PR\s*리뷰|리뷰.*해줘|review.*code/i,
    script: 'code-review.js',
    args: [],
    label: 'code-review',
  },
  {
    pattern: /복잡도.*분석|복잡도.*확인|complexity.*analyz|코드.*복잡도/i,
    script: 'complexity.js',
    args: [],
    label: 'complexity',
  },
  {
    pattern: /뭐였지|이전에.*결정|저번에.*결정|previous.*decision|what was.*decided/i,
    script: 'recall.js',
    args: [],
    label: 'recall',
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
