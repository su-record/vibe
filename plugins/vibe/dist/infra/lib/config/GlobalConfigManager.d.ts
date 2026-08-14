/**
 * GlobalConfigManager — ~/.vibe/config.json 통합 관리
 *
 * 모든 설정(credentials, channels, models, settings)을 하나의 파일로 관리.
 * 플랫폼 무관 ~/.vibe/ 디렉토리 사용.
 */
import type { GlobalVibeConfig } from '../../../cli/types.js';
/** ~/.vibe/ (플랫폼 무관 통일) */
export declare function getVibeDir(): string;
/** ~/.vibe/config.json */
export declare function getGlobalConfigPath(): string;
export declare function readGlobalConfig(): GlobalVibeConfig;
export declare function writeGlobalConfig(config: GlobalVibeConfig): void;
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export declare function patchGlobalConfig(patch: DeepPartial<GlobalVibeConfig>): void;
/** .vibe/config.json (프로젝트별 설정 SSOT) */
export declare function getProjectConfigPath(projectDir: string): string;
/** legacy .claude/vibe/config.json (읽기 fallback 전용) */
export declare function getLegacyProjectConfigPath(projectDir: string): string;
export declare function getProjectConfigPaths(projectDir: string): string[];
/**
 * 다중 계층 설정 병합: 글로벌(~/.vibe) + 프로젝트(.vibe)
 * 우선순위: 프로젝트 > 글로벌 (프로젝트 설정이 글로벌을 덮어씀)
 * credentials는 글로벌 전용 — 프로젝트에서 덮어쓰지 않음.
 */
export declare function resolveConfig(projectDir: string): GlobalVibeConfig;
export declare function getGptApiKey(): string | null;
export declare function getAntigravityApiKey(): string | null;
export declare function getZaiApiKey(): string | null;
export declare function getZaiCodingApiKey(): string | null;
export declare function getModelOverride(key: string): string | undefined;
/**
 * 레거시 파일들을 ~/.vibe/config.json 으로 마이그레이션.
 * 마이그레이션 후 기존 파일 삭제.
 */
export declare function migrateLegacyFiles(): void;
export {};
//# sourceMappingURL=GlobalConfigManager.d.ts.map