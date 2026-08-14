/**
 * Antigravity CLI 명령어
 *
 * - vibe antigravity key: API Key 설정
 * - vibe antigravity status: 상태 확인
 * - vibe antigravity logout: 설정 제거
 */
/**
 * Antigravity 인증 핵심 로직 (process.exit 없음)
 * API Key 확인
 */
export declare function antigravityAuthCore(): boolean;
/**
 * Antigravity 인증 (CLI 명령어용)
 */
export declare function antigravityAuth(): Promise<void>;
/**
 * Antigravity 상태 확인
 */
export declare function antigravityStatus(): void;
/**
 * Antigravity 로그아웃
 */
export declare function antigravityLogout(): void;
//# sourceMappingURL=antigravity-commands.d.ts.map