#!/usr/bin/env node
/**
 * vibe-gpt MCP Server
 * GPT API를 MCP 도구로 제공하여 Claude Code에서 서브에이전트로 활용
 *
 * 사용법:
 *   claude mcp add vibe-gpt node /path/to/vibe/dist/lib/gpt-mcp.js -s user
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// GPT API 모듈 로드
import * as gptApi from './gpt-api.js';
import * as gptStorage from './gpt-storage.js';

// MCP 서버 생성
const server = new Server(
  {
    name: 'vibe-gpt',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 정의
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'gpt_chat',
        description: 'GPT-5.2 모델에 질문하기. 아키텍처 분석, 디버깅, 복잡한 문제 해결에 활용. 서브에이전트로 사용 가능.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: '질문 또는 요청 내용',
            },
            model: {
              type: 'string',
              description: '사용할 모델 (gpt-5.2, gpt-5.2-codex, gpt-5.1-codex, gpt-5.1-codex-mini, gpt-5.1-codex-max)',
              default: 'gpt-5.2',
            },
            systemPrompt: {
              type: 'string',
              description: '시스템 프롬프트 (선택)',
            },
            maxTokens: {
              type: 'number',
              description: '최대 토큰 수',
              default: 4096,
            },
            temperature: {
              type: 'number',
              description: '온도 (0-1)',
              default: 0.7,
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'gpt_analyze_architecture',
        description: '아키텍처 분석 요청. GPT-5.2가 코드 구조와 설계를 분석하고 개선점을 제안.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: '분석할 코드 또는 아키텍처 설명',
            },
            context: {
              type: 'string',
              description: '프로젝트 컨텍스트 (선택)',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'gpt_debug',
        description: '디버깅 요청. GPT-5.2 Codex가 버그를 찾고 수정 방법을 제안.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: '디버깅할 코드',
            },
            error: {
              type: 'string',
              description: '에러 메시지 또는 증상 (선택)',
            },
            language: {
              type: 'string',
              description: '프로그래밍 언어 (선택)',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'gpt_quick_ask',
        description: '빠른 질문. 간단한 질문에 최적화 (GPT-5.1 Codex Mini 사용).',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: '질문 내용',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'gpt_auth_status',
        description: 'GPT OAuth 인증 상태 확인',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'gpt_list_models',
        description: '사용 가능한 GPT 모델 목록',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Types for tool arguments
interface ChatArgs {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

interface AnalyzeArgs {
  code: string;
  context?: string;
}

interface DebugArgs {
  code: string;
  error?: string;
  language?: string;
}

interface QuickAskArgs {
  prompt: string;
}

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'gpt_chat': {
        const { prompt, model, systemPrompt, maxTokens, temperature } = args as unknown as ChatArgs;
        const result = await gptApi.chat({
          model: model || 'gpt-5.2',
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: systemPrompt || '',
          maxTokens: maxTokens || 4096,
          temperature: temperature || 0.7,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                response: result.content,
                model: result.model,
              }, null, 2),
            },
          ],
        };
      }

      case 'gpt_analyze_architecture': {
        const { code, context } = args as unknown as AnalyzeArgs;
        const sysPrompt = `You are a senior software architect. Analyze the given code or architecture and provide detailed insights.

${context ? `Project context: ${context}` : ''}

Respond in Korean and provide:
1. 아키텍처 요약
2. 강점
3. 잠재적 문제점
4. 개선 제안
5. 확장성 평가`;

        const result = await gptApi.chat({
          model: 'gpt-5.2',
          messages: [{ role: 'user', content: code }],
          systemPrompt: sysPrompt,
          maxTokens: 8192,
          temperature: 0.5,
        });
        return {
          content: [
            {
              type: 'text',
              text: result.content,
            },
          ],
        };
      }

      case 'gpt_debug': {
        const { code, error, language } = args as unknown as DebugArgs;
        const sysPrompt = `You are an expert debugger. Analyze the given ${language || 'code'} and identify bugs.

${error ? `Error/Symptom: ${error}` : ''}

Respond in Korean and provide:
1. 버그 식별
2. 원인 분석
3. 수정된 코드
4. 예방 방법`;

        const result = await gptApi.chat({
          model: 'gpt-5.2-codex',
          messages: [{ role: 'user', content: code }],
          systemPrompt: sysPrompt,
          maxTokens: 4096,
          temperature: 0.3,
        });
        return {
          content: [
            {
              type: 'text',
              text: result.content,
            },
          ],
        };
      }

      case 'gpt_quick_ask': {
        const { prompt } = args as unknown as QuickAskArgs;
        const response = await gptApi.quickAsk(prompt);
        return {
          content: [
            {
              type: 'text',
              text: response,
            },
          ],
        };
      }

      case 'gpt_auth_status': {
        try {
          const account = gptStorage.getActiveAccount();
          if (account) {
            const isExpired = gptStorage.isTokenExpired(account);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    authenticated: true,
                    email: account.email,
                    tokenValid: !isExpired,
                    expires: new Date(account.expires).toISOString(),
                  }, null, 2),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    authenticated: false,
                    message: 'vibe gpt --auth 명령으로 인증하세요.',
                  }, null, 2),
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  authenticated: false,
                  error: (error as Error).message,
                }, null, 2),
              },
            ],
          };
        }
      }

      case 'gpt_list_models': {
        const models = gptApi.getAvailableModels();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = (error as Error).message;

    // 429 Rate Limit 또는 구독 에러 시 Claude fallback 안내
    if (errorMessage.includes('429') || errorMessage.includes('plan_type') || errorMessage.includes('usage_not_included')) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'fallback',
              reason: 'subscription_required',
              message: 'GPT API 접근 불가. ChatGPT Plus/Pro 구독이 필요합니다. Claude가 직접 처리해주세요.',
              original_error: errorMessage,
            }, null, 2),
          },
        ],
        isError: false, // fallback은 에러가 아님
      };
    }

    // 인증 에러 시 fallback 안내
    if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('인증')) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'fallback',
              reason: 'auth_error',
              message: 'GPT 인증 만료. Claude가 직접 처리해주세요. (vibe gpt --auth로 재인증 가능)',
              original_error: errorMessage,
            }, null, 2),
          },
        ],
        isError: false,
      };
    }

    // 기타 에러
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('vibe-gpt MCP server running');
}

main().catch(console.error);
