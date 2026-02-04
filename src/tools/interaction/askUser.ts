/**
 * AskUserQuestion Tool - 구조화된 사용자 질문 도구
 *
 * Claude Code의 AskUserQuestionTool 개념을 core에 통합
 * 필수 확인 항목에 대해 명시적인 질문-응답 플로우 제공
 *
 * @since v2.6.1
 */

import type { ToolResult } from '../../types/tool.js';

// ============================================================================
// Types
// ============================================================================

export type QuestionType =
  | 'single_select' // 단일 선택
  | 'multi_select' // 복수 선택
  | 'text' // 자유 텍스트
  | 'confirm' // Yes/No
  | 'number'; // 숫자 입력

export type QuestionCategory =
  | 'authentication' // 인증 방식
  | 'security' // 보안 요구사항
  | 'data_model' // 데이터 모델
  | 'session' // 세션 정책
  | 'performance' // 성능 요구사항
  | 'integration' // 외부 연동
  | 'scope' // 기능 범위
  | 'custom'; // 기타

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

export interface Question {
  id: string;
  category: QuestionCategory;
  type: QuestionType;
  question: string;
  description?: string;
  options?: QuestionOption[];
  defaultValue?: string | string[] | number | boolean;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
}

export interface QuestionResponse {
  questionId: string;
  value: string | string[] | number | boolean;
  timestamp: string;
}

export interface AskUserInput {
  questions: Question[];
  context?: string;
  featureName?: string;
  allowSkip?: boolean;
}

export interface AskUserOutput {
  formatted: string;
  questions: Question[];
  pendingCount: number;
  requiredCount: number;
}

// ============================================================================
// Predefined Question Templates
// ============================================================================

export const QUESTION_TEMPLATES: Record<string, Omit<Question, 'id'>> = {
  // Authentication
  auth_method: {
    category: 'authentication',
    type: 'multi_select',
    question: '어떤 인증 방식을 지원할까요?',
    options: [
      { value: 'email_password', label: '이메일/비밀번호', isDefault: true },
      { value: 'social_google', label: 'Google 소셜 로그인' },
      { value: 'social_apple', label: 'Apple 소셜 로그인' },
      { value: 'social_github', label: 'GitHub 소셜 로그인' },
      { value: 'passkey', label: 'Passkey (WebAuthn)' },
      { value: 'magic_link', label: 'Magic Link (이메일)' },
      { value: 'sms_otp', label: 'SMS OTP' },
    ],
    required: true,
  },

  mfa_required: {
    category: 'authentication',
    type: 'confirm',
    question: '다중 인증(MFA)을 지원할까요?',
    description: 'TOTP, SMS 등 2차 인증 수단',
    defaultValue: false,
    required: true,
  },

  // Session
  session_duration: {
    category: 'session',
    type: 'single_select',
    question: '세션 만료 시간을 선택하세요',
    options: [
      { value: '30m', label: '30분' },
      { value: '1h', label: '1시간', isDefault: true },
      { value: '24h', label: '24시간' },
      { value: '7d', label: '7일' },
      { value: '30d', label: '30일' },
      { value: 'never', label: '만료 없음' },
    ],
    required: true,
  },

  concurrent_session: {
    category: 'session',
    type: 'single_select',
    question: '동시 로그인을 허용할까요?',
    options: [
      { value: 'single', label: '단일 세션만 허용' },
      { value: 'limited', label: '최대 3개 세션' },
      { value: 'unlimited', label: '무제한', isDefault: true },
    ],
    required: true,
  },

  // Security
  password_policy: {
    category: 'security',
    type: 'single_select',
    question: '비밀번호 정책 수준을 선택하세요',
    options: [
      { value: 'basic', label: '기본 (8자 이상)' },
      {
        value: 'standard',
        label: '표준 (8자+대소문자+숫자)',
        isDefault: true,
      },
      { value: 'strong', label: '강력 (12자+대소문자+숫자+특수문자)' },
    ],
    required: true,
  },

  rate_limit: {
    category: 'security',
    type: 'single_select',
    question: '로그인 시도 제한 정책을 선택하세요',
    options: [
      { value: 'none', label: '제한 없음' },
      {
        value: 'standard',
        label: '5회 실패 시 5분 잠금',
        isDefault: true,
      },
      { value: 'strict', label: '3회 실패 시 30분 잠금' },
    ],
    required: true,
  },

  // Data Model
  user_profile_fields: {
    category: 'data_model',
    type: 'multi_select',
    question: '사용자 프로필에 포함할 필드를 선택하세요',
    options: [
      { value: 'display_name', label: '표시 이름', isDefault: true },
      { value: 'avatar', label: '프로필 이미지' },
      { value: 'phone', label: '전화번호' },
      { value: 'address', label: '주소' },
      { value: 'birthdate', label: '생년월일' },
      { value: 'bio', label: '자기소개' },
    ],
    required: false,
  },

  // Performance
  response_time_target: {
    category: 'performance',
    type: 'single_select',
    question: 'API 응답 시간 목표를 선택하세요',
    options: [
      { value: '100ms', label: '100ms 이하 (실시간)' },
      { value: '500ms', label: '500ms 이하', isDefault: true },
      { value: '1s', label: '1초 이하' },
      { value: '3s', label: '3초 이하' },
    ],
    required: false,
  },

  // Integration
  external_apis: {
    category: 'integration',
    type: 'multi_select',
    question: '연동할 외부 서비스가 있나요?',
    options: [
      { value: 'none', label: '없음', isDefault: true },
      { value: 'payment', label: '결제 (Stripe, Toss)' },
      { value: 'email', label: '이메일 (SendGrid, SES)' },
      { value: 'sms', label: 'SMS (Twilio, Aligo)' },
      { value: 'push', label: '푸시 알림 (FCM, APNs)' },
      { value: 'analytics', label: '분석 (GA, Mixpanel)' },
    ],
    required: false,
  },
};

// ============================================================================
// Question Builder
// ============================================================================

/**
 * 질문 ID 생성
 */
export function generateQuestionId(
  category: QuestionCategory,
  index: number
): string {
  return `Q-${category.toUpperCase()}-${String(index).padStart(3, '0')}`;
}

/**
 * 템플릿에서 질문 생성
 */
export function createQuestionFromTemplate(
  templateKey: string,
  overrides?: Partial<Question>
): Question | null {
  const template = QUESTION_TEMPLATES[templateKey];
  if (!template) return null;

  return {
    id: generateQuestionId(template.category, Date.now() % 1000),
    ...template,
    ...overrides,
  };
}

/**
 * 카테고리별 필수 질문 세트 생성
 */
export function createRequiredQuestionSet(
  categories: QuestionCategory[]
): Question[] {
  const questions: Question[] = [];

  const categoryTemplates: Record<QuestionCategory, string[]> = {
    authentication: ['auth_method', 'mfa_required'],
    security: ['password_policy', 'rate_limit'],
    session: ['session_duration', 'concurrent_session'],
    data_model: ['user_profile_fields'],
    performance: ['response_time_target'],
    integration: ['external_apis'],
    scope: [],
    custom: [],
  };

  for (const category of categories) {
    const templates = categoryTemplates[category] || [];
    for (const templateKey of templates) {
      const question = createQuestionFromTemplate(templateKey);
      if (question) {
        questions.push(question);
      }
    }
  }

  return questions;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * 질문을 마크다운 형식으로 포맷
 */
export function formatQuestionAsMarkdown(question: Question): string {
  const lines: string[] = [];

  // Category & ID
  const categoryEmoji = getCategoryEmoji(question.category);
  lines.push(`### ${categoryEmoji} ${question.id}`);
  lines.push('');

  // Question
  lines.push(`**${question.question}**`);
  if (question.description) {
    lines.push(`> ${question.description}`);
  }
  lines.push('');

  // Options or input type
  if (question.options && question.options.length > 0) {
    const selectHint =
      question.type === 'multi_select' ? '(복수 선택 가능)' : '(하나만 선택)';
    lines.push(selectHint);
    lines.push('');

    question.options.forEach((opt, idx) => {
      const defaultMark = opt.isDefault ? ' ✓' : '';
      const desc = opt.description ? ` - ${opt.description}` : '';
      lines.push(`${idx + 1}. **${opt.label}**${defaultMark}${desc}`);
    });
  } else if (question.type === 'confirm') {
    lines.push('- Y: 예');
    lines.push('- N: 아니오');
  } else if (question.type === 'text') {
    lines.push('_자유롭게 입력하세요_');
  } else if (question.type === 'number') {
    const validation = question.validation;
    if (validation) {
      const range = [];
      if (validation.min !== undefined) range.push(`최소: ${validation.min}`);
      if (validation.max !== undefined) range.push(`최대: ${validation.max}`);
      if (range.length > 0) lines.push(`_${range.join(', ')}_`);
    }
  }

  lines.push('');
  lines.push(question.required ? '**필수**' : '_선택_');

  return lines.join('\n');
}

/**
 * 카테고리별 이모지
 */
function getCategoryEmoji(category: QuestionCategory): string {
  const emojis: Record<QuestionCategory, string> = {
    authentication: '🔐',
    security: '🛡️',
    data_model: '📊',
    session: '⏱️',
    performance: '⚡',
    integration: '🔗',
    scope: '📋',
    custom: '❓',
  };
  return emojis[category] || '❓';
}

/**
 * 전체 질문 세트를 포맷
 */
export function formatQuestionsForUser(input: AskUserInput): AskUserOutput {
  const lines: string[] = [];

  // Header
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📋 요구사항 확인');
  if (input.featureName) {
    lines.push(`Feature: ${input.featureName}`);
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (input.context) {
    lines.push(input.context);
    lines.push('');
  }

  // Group by category
  const grouped = new Map<QuestionCategory, Question[]>();
  for (const q of input.questions) {
    const list = grouped.get(q.category) || [];
    list.push(q);
    grouped.set(q.category, list);
  }

  // Format each category
  for (const [category, questions] of grouped) {
    const categoryName = getCategoryName(category);
    lines.push(`## ${getCategoryEmoji(category)} ${categoryName}`);
    lines.push('');

    for (const q of questions) {
      lines.push(formatQuestionAsMarkdown(q));
      lines.push('');
    }
  }

  // Summary
  const requiredCount = input.questions.filter((q) => q.required).length;
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`총 ${input.questions.length}개 질문 (필수: ${requiredCount}개)`);
  if (input.allowSkip) {
    lines.push('_선택 항목은 Enter로 건너뛸 수 있습니다_');
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    formatted: lines.join('\n'),
    questions: input.questions,
    pendingCount: input.questions.length,
    requiredCount,
  };
}

/**
 * 카테고리 한글명
 */
function getCategoryName(category: QuestionCategory): string {
  const names: Record<QuestionCategory, string> = {
    authentication: '인증',
    security: '보안',
    data_model: '데이터 모델',
    session: '세션',
    performance: '성능',
    integration: '외부 연동',
    scope: '기능 범위',
    custom: '기타',
  };
  return names[category] || '기타';
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * 사용자 응답 파싱
 */
export function parseUserResponse(
  question: Question,
  rawResponse: string
): QuestionResponse | { error: string } {
  const response = rawResponse.trim();

  if (!response && question.required) {
    return { error: '필수 항목입니다. 응답을 입력해주세요.' };
  }

  if (!response && question.defaultValue !== undefined) {
    return {
      questionId: question.id,
      value: question.defaultValue,
      timestamp: new Date().toISOString(),
    };
  }

  switch (question.type) {
    case 'single_select': {
      if (!question.options) {
        return { error: '옵션이 정의되지 않았습니다.' };
      }
      const index = parseInt(response, 10) - 1;
      if (isNaN(index) || index < 0 || index >= question.options.length) {
        return {
          error: `1-${question.options.length} 사이의 숫자를 입력하세요.`,
        };
      }
      return {
        questionId: question.id,
        value: question.options[index].value,
        timestamp: new Date().toISOString(),
      };
    }

    case 'multi_select': {
      if (!question.options) {
        return { error: '옵션이 정의되지 않았습니다.' };
      }
      const indices = response.split(/[,\s]+/).map((s) => parseInt(s, 10) - 1);
      const values: string[] = [];
      for (const idx of indices) {
        if (isNaN(idx) || idx < 0 || idx >= question.options.length) {
          return {
            error: `유효한 번호를 입력하세요 (1-${question.options.length})`,
          };
        }
        values.push(question.options[idx].value);
      }
      return {
        questionId: question.id,
        value: values,
        timestamp: new Date().toISOString(),
      };
    }

    case 'confirm': {
      const lower = response.toLowerCase();
      if (['y', 'yes', '예', '네', 'true'].includes(lower)) {
        return {
          questionId: question.id,
          value: true,
          timestamp: new Date().toISOString(),
        };
      }
      if (['n', 'no', '아니오', '아니요', 'false'].includes(lower)) {
        return {
          questionId: question.id,
          value: false,
          timestamp: new Date().toISOString(),
        };
      }
      return { error: 'Y 또는 N을 입력하세요.' };
    }

    case 'number': {
      const num = parseFloat(response);
      if (isNaN(num)) {
        return { error: '숫자를 입력하세요.' };
      }
      const validation = question.validation;
      if (validation) {
        if (validation.min !== undefined && num < validation.min) {
          return { error: `최소값은 ${validation.min}입니다.` };
        }
        if (validation.max !== undefined && num > validation.max) {
          return { error: `최대값은 ${validation.max}입니다.` };
        }
      }
      return {
        questionId: question.id,
        value: num,
        timestamp: new Date().toISOString(),
      };
    }

    case 'text':
    default:
      if (question.validation?.pattern) {
        const regex = new RegExp(question.validation.pattern);
        if (!regex.test(response)) {
          return {
            error: question.validation.customMessage || '형식이 올바르지 않습니다.',
          };
        }
      }
      return {
        questionId: question.id,
        value: response,
        timestamp: new Date().toISOString(),
      };
  }
}

// ============================================================================
// Main Tool Handler
// ============================================================================

export interface AskUserParams {
  featureName: string;
  categories?: QuestionCategory[];
  customQuestions?: Question[];
  context?: string;
}

/**
 * askUser - 사용자에게 필수 확인 질문 생성
 *
 * @example
 * ```typescript
 * const result = await askUser({
 *   featureName: 'login',
 *   categories: ['authentication', 'security', 'session'],
 * });
 * console.log(result.content[0].text);
 * ```
 */
export async function askUser(params: AskUserParams): Promise<ToolResult> {
  const { featureName, categories = [], customQuestions = [], context } = params;

  // Generate questions
  const templateQuestions = createRequiredQuestionSet(categories);
  const allQuestions = [...templateQuestions, ...customQuestions];

  if (allQuestions.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: '⚠️ 질문이 없습니다. categories 또는 customQuestions를 지정하세요.',
        },
      ],
    };
  }

  // Format output
  const output = formatQuestionsForUser({
    questions: allQuestions,
    featureName,
    context,
    allowSkip: true,
  });

  return {
    content: [
      {
        type: 'text',
        text: output.formatted,
      },
    ],
    _meta: {
      questions: output.questions,
      pendingCount: output.pendingCount,
      requiredCount: output.requiredCount,
    },
  };
}

/**
 * Quick helper for common scenarios
 */
export const askUserQuick = {
  /**
   * 로그인 기능 관련 질문
   */
  login: (featureName = 'login') =>
    askUser({
      featureName,
      categories: ['authentication', 'security', 'session'],
    }),

  /**
   * API 기능 관련 질문
   */
  api: (featureName: string) =>
    askUser({
      featureName,
      categories: ['security', 'performance', 'integration'],
    }),

  /**
   * 사용자 관리 기능 관련 질문
   */
  userManagement: (featureName = 'user-management') =>
    askUser({
      featureName,
      categories: ['authentication', 'data_model', 'security'],
    }),
};

export default askUser;
