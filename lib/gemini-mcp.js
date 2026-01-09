#!/usr/bin/env node
/**
 * vibe-gemini MCP Server
 * Gemini API를 MCP 도구로 제공하여 Claude Code에서 서브에이전트로 활용
 *
 * 사용법:
 *   claude mcp add vibe-gemini node /path/to/vibe/lib/gemini-mcp.js
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Gemini API 모듈 로드
const geminiApi = require('./gemini-api.js');
const geminiOAuth = require('./gemini-oauth.js');

// MCP 서버 생성
const server = new Server(
  {
    name: 'vibe-gemini',
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
        name: 'gemini_chat',
        description: 'Gemini 모델에 질문하기. 코드 분석, UI/UX 검토, 아키텍처 상담 등에 활용. 서브에이전트로 사용 가능.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: '질문 또는 요청 내용',
            },
            model: {
              type: 'string',
              description: '사용할 모델 (gemini-2.5-flash, gemini-3-flash, gemini-3-pro)',
              default: 'gemini-2.5-flash',
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
        name: 'gemini_analyze_code',
        description: '코드 분석 요청. Gemini가 코드를 분석하고 개선점을 제안.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: '분석할 코드',
            },
            language: {
              type: 'string',
              description: '프로그래밍 언어',
            },
            focus: {
              type: 'string',
              description: '분석 초점 (performance, security, readability, all)',
              default: 'all',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'gemini_review_ui',
        description: 'UI/UX 리뷰 요청. Gemini가 UI 설계를 분석하고 피드백 제공.',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'UI 설명 또는 구조',
            },
            context: {
              type: 'string',
              description: '프로젝트 컨텍스트 (선택)',
            },
          },
          required: ['description'],
        },
      },
      {
        name: 'gemini_quick_ask',
        description: '빠른 질문. 코드 탐색이나 간단한 질문에 최적화 (낮은 temperature, 짧은 응답).',
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
        name: 'gemini_auth_status',
        description: 'Gemini OAuth 인증 상태 확인',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'gemini_list_models',
        description: '사용 가능한 Gemini 모델 목록',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'gemini_chat': {
        const { prompt, model, systemPrompt, maxTokens, temperature } = args;
        const result = await geminiApi.chat({
          model: model || 'gemini-2.5-flash',
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
                usage: result.usage,
              }, null, 2),
            },
          ],
        };
      }

      case 'gemini_analyze_code': {
        const { code, language, focus } = args;
        const systemPrompt = `You are an expert code reviewer. Analyze the given ${language || 'code'} and provide detailed feedback focusing on: ${focus || 'all aspects including performance, security, readability, and best practices'}.

Respond in Korean and provide:
1. 코드 요약
2. 주요 이슈 (있다면)
3. 개선 제안
4. 전체 품질 점수 (1-10)`;

        const result = await geminiApi.chat({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: code }],
          systemPrompt,
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

      case 'gemini_review_ui': {
        const { description, context } = args;
        const systemPrompt = `You are a UI/UX expert. Review the given UI description and provide detailed feedback.

${context ? `Project context: ${context}` : ''}

Respond in Korean and provide:
1. UI 구조 평가
2. UX 개선점
3. 접근성 체크
4. 모범 사례 비교
5. 구체적인 개선 제안`;

        const result = await geminiApi.chat({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: description }],
          systemPrompt,
          maxTokens: 4096,
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

      case 'gemini_quick_ask': {
        const { prompt } = args;
        const response = await geminiApi.quickAsk(prompt);
        return {
          content: [
            {
              type: 'text',
              text: response,
            },
          ],
        };
      }

      case 'gemini_auth_status': {
        try {
          const isAuth = await geminiOAuth.isAuthenticated();
          if (isAuth) {
            const { accessToken, projectId } = await geminiOAuth.getValidAccessToken();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    authenticated: true,
                    projectId: projectId || 'default',
                    tokenValid: !!accessToken,
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
                    message: 'vibe gemini --auth 명령으로 인증하세요.',
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
                  error: error.message,
                }, null, 2),
              },
            ],
          };
        }
      }

      case 'gemini_list_models': {
        const models = geminiApi.getAvailableModels();
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
    // 429 Rate Limit 에러 시 Claude fallback 안내
    if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'fallback',
              reason: 'rate_limit',
              message: 'Gemini API 할당량 초과. Claude가 직접 처리해주세요.',
              original_error: error.message,
            }, null, 2),
          },
        ],
        isError: false, // fallback은 에러가 아님
      };
    }

    // 인증 에러 시 fallback 안내
    if (error.message.includes('401') || error.message.includes('403') || error.message.includes('invalid_grant')) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'fallback',
              reason: 'auth_error',
              message: 'Gemini 인증 만료. Claude가 직접 처리해주세요. (vibe gemini --auth로 재인증 가능)',
              original_error: error.message,
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
          text: `Error: ${error.message}`,
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
  console.error('vibe-gemini MCP server running');
}

main().catch(console.error);
