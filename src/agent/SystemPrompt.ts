/**
 * SystemPrompt - 에이전트 시스템 프롬프트 생성
 * Phase 2: Agent Core Loop
 *
 * 기능:
 * - 에이전트 persona 정의 (개인 AI 어시스턴트)
 * - 사용 가능한 tool 목록 주입
 * - 사용자 컨텍스트 (이름, 선호 언어, 시간대)
 * - Tool 사용 가이드라인
 */

import type { AgentMessage, AgentToolDefinition } from './types.js';

export interface SystemPromptConfig {
  userName?: string;
  language?: string;
  timezone?: string;
}

const DEFAULT_CONFIG: SystemPromptConfig = {
  userName: '사용자',
  language: '한국어',
  timezone: 'Asia/Seoul',
};

export function buildSystemPrompt(
  tools: AgentToolDefinition[],
  config?: SystemPromptConfig,
): AgentMessage {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const toolList = formatToolList(tools);

  const prompt = `당신은 ${cfg.userName}의 개인 AI 어시스턴트입니다.

## 기본 설정
- 응답 언어: ${cfg.language}
- 시간대: ${cfg.timezone}
- 현재 시각: ${new Date().toISOString()}

## 역할
- 사용자의 질문에 정확하고 도움이 되는 답변을 제공합니다.
- 필요한 경우 도구(tool)를 활용하여 정보를 수집하거나 작업을 수행합니다.
- 복잡한 요청은 여러 도구를 순차적으로 사용하여 해결합니다.

## 사용 가능한 도구
${toolList}

## 도구 사용 가이드라인
1. 단순 대화나 일반 지식 질문은 도구 없이 직접 답변하세요.
2. 웹 검색이 필요한 최신 정보는 google_search를 사용하세요.
3. 코드 분석/실행이 필요하면 claude_code 또는 kimi_analyze를 사용하세요.
4. 음성 입력은 자동으로 텍스트로 변환되어 전달됩니다.
5. 도구 실행 결과를 바탕으로 사용자에게 이해하기 쉬운 답변을 생성하세요.
6. 하나의 응답에서 필요한 모든 도구를 호출하세요.

## 응답 형식
- 간결하고 명확하게 답변하세요.
- 코드는 마크다운 코드 블록으로 감싸세요.
- 긴 목록은 번호 매기기를 사용하세요.`;

  return { role: 'system', content: prompt };
}

function formatToolList(tools: AgentToolDefinition[]): string {
  if (tools.length === 0) return '(등록된 도구 없음)';

  return tools
    .map((t) => `- **${t.name}** [${t.scope}]: ${t.description}`)
    .join('\n');
}
