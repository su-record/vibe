/**
 * ZAI (Z.ai / GLM) CLI 명령어
 *
 * - vibe zai key <k>          일반 API 키 설정 (pay-as-you-go)
 * - vibe zai coding-key <k>   GLM Coding Plan 키 설정 (UI/코드 담당, 별도 키)
 * - vibe zai status           상태 확인
 * - vibe zai logout           설정 제거
 */
/** 일반(pay-as-you-go) API 키 저장 */
export declare function setZaiKey(apiKey: string): void;
/** GLM Coding Plan 키 저장 (UI/코드 담당) */
export declare function setZaiCodingKey(apiKey: string): void;
export declare function zaiStatus(): void;
export declare function zaiLogout(): void;
//# sourceMappingURL=zai-commands.d.ts.map