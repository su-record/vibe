/**
 * AskUserQuestion Tool - 구조화된 사용자 질문 도구
 *
 * Claude Code의 AskUserQuestionTool 개념을 core에 통합
 * 필수 확인 항목에 대해 명시적인 질문-응답 플로우 제공
 */
import type { ToolResult } from '../../infra/types/tool.js';
export type QuestionType = 'single_select' | 'multi_select' | 'text' | 'confirm' | 'number';
export type QuestionCategory = 'authentication' | 'security' | 'data_model' | 'session' | 'performance' | 'integration' | 'scope' | 'custom';
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
export declare const QUESTION_TEMPLATES: Record<string, Omit<Question, 'id'>>;
/**
 * 질문 ID 생성
 */
export declare function generateQuestionId(category: QuestionCategory, index: number): string;
/**
 * 템플릿에서 질문 생성
 */
export declare function createQuestionFromTemplate(templateKey: string, overrides?: Partial<Question>): Question | null;
/**
 * 카테고리별 필수 질문 세트 생성
 */
export declare function createRequiredQuestionSet(categories: QuestionCategory[]): Question[];
/**
 * 질문을 마크다운 형식으로 포맷
 */
export declare function formatQuestionAsMarkdown(question: Question): string;
/**
 * 전체 질문 세트를 포맷
 */
export declare function formatQuestionsForUser(input: AskUserInput): AskUserOutput;
/**
 * 사용자 응답 파싱
 */
export declare function parseUserResponse(question: Question, rawResponse: string): QuestionResponse | {
    error: string;
};
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
export declare function askUser(params: AskUserParams): Promise<ToolResult>;
/**
 * Quick helper for common scenarios
 */
export declare const askUserQuick: {
    /**
     * 로그인 기능 관련 질문
     */
    login: (featureName?: string) => Promise<ToolResult>;
    /**
     * API 기능 관련 질문
     */
    api: (featureName: string) => Promise<ToolResult>;
    /**
     * 사용자 관리 기능 관련 질문
     */
    userManagement: (featureName?: string) => Promise<ToolResult>;
};
export default askUser;
//# sourceMappingURL=askUser.d.ts.map