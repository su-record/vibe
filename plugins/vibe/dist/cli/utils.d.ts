/**
 * CLI 유틸리티 함수
 */
export declare function setSilentMode(silent: boolean): void;
/**
 * 로그 출력 (silent 모드 지원)
 */
export declare function log(message: string): void;
/**
 * 디렉토리 생성 (재귀)
 */
export declare function ensureDir(dir: string): void;
/**
 * 디렉토리 내용 복사 (1단계만)
 */
export declare function copyDirContents(sourceDir: string, targetDir: string): void;
/**
 * 디렉토리 재귀 복사
 */
export declare function copyDirRecursive(sourceDir: string, targetDir: string): void;
/**
 * 디렉토리 재귀 삭제
 */
export declare function removeDirRecursive(dirPath: string): void;
/**
 * package.json 읽기
 */
export declare function getPackageJson(): {
    version: string;
};
/**
 * 버전 비교 (semver)
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
export declare function compareVersions(a: string, b: string): number;
/**
 * __dirname 반환 (ESM 호환)
 */
export declare function getCliDir(): string;
/**
 * scope-guard 자동 동기화 opt-in 여부.
 * `.vibe/config.json` (또는 legacy `.claude/vibe/`) 의
 * `scopeGuard.enabled === true` 일 때만 활성. 기본 off
 * (자동 ON 은 SPEC 외 편집에 노이즈 경고 회귀를 유발해 의도적으로 off).
 * SSOT: 런타임 훅 hooks/scripts/lib/scope-from-spec.js `isScopeGuardEnabled` 와
 * 반드시 같은 기본값을 유지할 것 (harness-review-2026-07-01 P1-6).
 */
export declare function isScopeGuardOptedIn(projectRoot: string): boolean;
//# sourceMappingURL=utils.d.ts.map