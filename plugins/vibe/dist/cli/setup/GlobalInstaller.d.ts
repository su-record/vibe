/**
 * GlobalInstaller - 전역 패키지 및 자산 설치
 */
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
/**
 * 전역 vibe 패키지 설치 경로 (getCoreConfigDir = getGlobalConfigDir alias)
 */
export declare const getCoreConfigDir: typeof getGlobalConfigDir;
export declare function writeHookPackageJson(globalCoreDir: string): void;
//# sourceMappingURL=GlobalInstaller.d.ts.map