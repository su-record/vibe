/**
 * 전역 설정 관리
 */
/**
 * 패키지의 .env 파싱 → settings.json env 섹션에 주입
 * 빌드 시 .env.example → .env 변환됨
 * 값이 있는 변수만 주입 (빈 값은 무시)
 * 이미 settings.json에 값이 있으면 덮어쓰지 않음 (사용자 설정 보존)
 */
export declare function injectEnvDefaults(packageRoot: string): void;
/**
 * 전역 ~/.claude/settings.json에서 hooks 정리
 * core는 이제 프로젝트 레벨 (.claude/settings.local.json)에서 훅을 관리하므로
 * 전역 설정의 hooks는 제거해야 함 (레거시 정리)
 */
export declare function cleanupGlobalSettingsHooks(): void;
/**
 * 전역 ~/.claude/settings.json에 env 변수 설정
 * 모든 세션, 모든 프로젝트에서 동일하게 적용되어야 하는 환경변수를 전역 설정에 등록
 */
export declare function ensureGlobalEnvSettings(): void;
//# sourceMappingURL=global-config.d.ts.map