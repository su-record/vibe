/**
 * 공통 유틸리티 함수
 */
/**
 * 지정된 시간만큼 대기
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * PATH에서 실행 파일 존재 여부를 탐색 (which/where 서브프로세스 없이 크로스 플랫폼)
 * - POSIX: 실행 권한(X_OK)까지 확인
 * - Windows: PATHEXT 확장자(.exe/.cmd 등)를 붙여 파일 존재 확인
 */
export declare function findExecutableInPath(name: string): boolean;
export declare function getAgentSdkQuery(): Promise<typeof import("@anthropic-ai/claude-agent-sdk").query | null>;
/**
 * 디버그 로깅 (환경변수로 제어)
 */
export declare function debugLog(message: string, ...args: unknown[]): void;
/**
 * 경고 로깅 (환경변수로 제어)
 */
export declare function warnLog(message: string, ...args: unknown[]): void;
/**
 * 에러 로깅 (항상 출력, 단 verbose 모드에서만 상세)
 */
export declare function errorLog(message: string, error?: unknown): void;
/**
 * Error severity levels for consistent error handling across the codebase.
 * - fatal: must stop execution, user needs to know
 * - recoverable: can continue, but warn user
 * - ignorable: truly safe to ignore (e.g., legacy cleanup, optional features)
 */
export type ErrorSeverity = 'fatal' | 'recoverable' | 'ignorable';
/**
 * Extract a human-readable message from an unknown caught value.
 */
export declare function extractErrorMessage(error: unknown): string;
/**
 * Handle a caught error according to its severity.
 *
 * - fatal: logs to stderr and re-throws
 * - recoverable: logs a user-visible warning (via warnFn) and continues
 * - ignorable: logs only in debug mode
 *
 * @param severity - how critical the error is
 * @param context - short description of what was being attempted
 * @param error - the caught value
 * @param warnFn - optional callback for user-visible warnings (defaults to stderr)
 */
export declare function handleCaughtError(severity: ErrorSeverity, context: string, error: unknown, warnFn?: (msg: string) => void): void;
/**
 * 안전한 JSON 파싱
 * @param jsonString 파싱할 JSON 문자열
 * @param context 에러 로깅에 사용할 컨텍스트 설명
 * @returns 파싱된 객체 또는 null
 */
export declare function safeParseJSON<T = unknown>(jsonString: string, context?: string): T | null;
/**
 * 안전한 JSON 파싱 (기본값 반환)
 * @param jsonString 파싱할 JSON 문자열
 * @param defaultValue 파싱 실패 시 반환할 기본값
 * @param context 에러 로깅에 사용할 컨텍스트 설명
 * @returns 파싱된 객체 또는 기본값
 */
export declare function safeParseJSONWithDefault<T>(jsonString: string, defaultValue: T, context?: string): T;
//# sourceMappingURL=utils.d.ts.map