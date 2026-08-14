/**
 * LegacyMigration - 레거시 마이그레이션 및 정리
 */
/**
 * Legacy `.claude/vibe/`, `.claude/memories/` 를
 * 새 SSOT `.vibe/` 로 통합.
 *
 * 동작:
 *  - `.vibe/` 가 없으면 legacy 경로를 그대로 rename (기존 init/update 가 하던 동작).
 *  - `.vibe/` 가 있으면 legacy 파일을 병합: target 에 없는 것만 복사하고 legacy 는 제거.
 *  - `.claude/memories/` → `.vibe/memories/` (같은 로직).
 *  - legacy 디렉토리가 비게 되면 자동 정리 (상위의 `.claude` 자체는 건드리지 않음).
 *
 * 이미 통합된 프로젝트는 no-op.
 * @returns 이동/제거한 legacy 경로 목록 (user-facing 로그용)
 */
export declare function consolidateLegacyVibe(projectRoot: string): string[];
/**
 * .core/ → .claude/vibe/ 마이그레이션
 */
export declare function migrateLegacyCore(projectRoot: string, coreDir: string): boolean;
/**
 * 레거시 파일/폴더 정리
 */
export declare function cleanupLegacy(projectRoot: string, claudeDir: string): void;
/**
 * 프로젝트 로컬 설정/자산 제거 (core 소유 파일만 선별 삭제, 사용자 커스텀 파일 보존)
 */
export declare function removeLocalAssets(claudeDir: string, packageRoot?: string): void;
/**
 * ~/.claude.json 정리 (로컬 MCP 설정 제거)
 */
export declare function cleanupClaudeConfig(): void;
/**
 * 레거시 mcp/ 폴더 정리
 */
export declare function cleanupLegacyMcp(coreDir: string): void;
//# sourceMappingURL=LegacyMigration.d.ts.map