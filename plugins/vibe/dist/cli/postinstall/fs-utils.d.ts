/**
 * 파일시스템 유틸리티
 */
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
/**
 * 전역 vibe 설정 디렉토리 경로 (getCoreConfigDir = getGlobalConfigDir alias)
 */
export declare const getCoreConfigDir: typeof getGlobalConfigDir;
/**
 * 디렉토리 내 모든 .md 파일에서 {{VIBE_PATH}} / {{VIBE_PATH_URL}} 템플릿 치환
 * - {{VIBE_PATH}}     → ~/.vibe  (forward slash)
 * - {{VIBE_PATH_URL}} → file:///~/.vibe/
 */
export declare function replaceTemplatesInDir(dirPath: string): void;
/**
 * 디렉토리 생성 (재귀)
 */
export declare function ensureDir(dir: string): void;
/**
 * 디렉토리 복사 (재귀, node_modules/.git 제외)
 */
export declare function copyDirRecursive(src: string, dest: string): void;
/**
 * 디렉토리 삭제 (재귀)
 */
export declare function removeDirRecursive(dir: string): void;
/**
 * 스킬 복사 (항상 덮어쓰기 — 패키지 업데이트 시 최신 버전 반영)
 */
export declare function copySkillsOverwrite(src: string, dest: string): void;
/**
 * 스킬 디렉토리에서 배송본에 없는 파일을 제거한다 (mirror).
 *
 * WHY: `copySkillsOverwrite` 는 덮어쓰기만 하므로 배송본에서 **삭제·개명된** 파일이
 * 설치본에 영구 잔존했다. 실제 사례 — `references/ralph-loop.md` 와
 * `references/ultrawork-mode.md` 를 내용 모순(존재하지 않는 L0~L4 레벨 체계, SSOT 와
 * 반대인 stuck 시맨틱) 때문에 삭제하고 새 파일로 교체했는데, `vibe upgrade` 후에도 구
 * 파일이 남아 모델이 계속 읽을 수 있었다. 스킬 문서는 모델이 읽는 계약이므로, 철회한
 * 계약이 남아 있는 것은 단순 잔재가 아니라 **잘못된 지시가 살아있는 것**이다.
 *
 * 스킬 디렉토리는 vibe 관리 영역이고(배송 파일을 무조건 덮어쓴다) 사용자 편집 대상이
 * 아니므로 mirror 가 안전하다. 무엇을 지웠는지 호출자가 보고할 수 있도록 반환한다 —
 * 조용한 삭제를 만들지 않는다.
 *
 * @returns 제거된 경로 (dest 기준 상대경로)
 */
export declare function pruneExtraneousSkillFiles(src: string, dest: string): string[];
/**
 * 레거시 스킬 디렉토리 삭제 (이름 변경된 구 디렉토리 정리)
 */
export declare function removeLegacySkills(skillsDir: string, legacyDirs: ReadonlyArray<string>): void;
/**
 * 디렉토리 기반 스킬 모두 정리 — ~/.claude/vibe/skills/ 에 남아있는 {name}/ 디렉토리 제거
 * Claude Code가 ~/.claude/ 재귀 스캔 시 ~/.claude/skills/와 중복 발견되므로 제거 필요
 * flat .md 파일(인라인 스킬)은 유지
 */
export declare function cleanupDuplicateSkillDirs(skillsDir: string): void;
/**
 * 스킬 필터링 복사 — 허용 목록에 있는 스킬 디렉토리만 복사
 * @param src - 스킬 소스 디렉토리 (skills/)
 * @param dest - 설치 대상 디렉토리
 * @param allowedSkills - 복사할 스킬 이름 목록
 */
export declare function copySkillsFiltered(src: string, dest: string, allowedSkills: ReadonlyArray<string>): string[];
/**
 * optional 스킬 정리 결정 결과
 */
export type OptionalSkillAction = 'removed' | 'skipped-user-modified' | 'skipped-not-vibe' | 'notice';
export interface OptionalSkillResult {
    name: string;
    action: OptionalSkillAction;
    reason: string;
}
/**
 * 전역 스킬 디렉토리에서 optional 스킬을 정리한다.
 *
 * 안전 규칙:
 * - vibe 소유이고 (SKILL.md `name:` 매치)
 * - 배송된 내용과 동일(사용자 미수정)인 경우에만 삭제
 * - 그 외에는 notice 로그만 남기고 보존
 *
 * @param globalSkillsDir - 전역 CLI 스킬 디렉토리 (e.g. ~/.claude/skills)
 * @param optionalSkills - 정리 대상 스킬 이름 목록
 * @param shippedSkillsDir - 패키지 내 skills/ 디렉토리 (비교 기준)
 * @param dryRun - true이면 실제 삭제 없이 결과만 반환
 */
export declare function cleanupOptionalSkills(globalSkillsDir: string, optionalSkills: ReadonlyArray<string>, shippedSkillsDir: string, dryRun?: boolean): OptionalSkillResult[];
export declare function cleanupRenamedSkills(globalSkillsDir: string, renames: Readonly<Record<string, string>>, legacyHashes: Readonly<Record<string, string>>): OptionalSkillResult[];
/**
 * Codex는 Vibe의 `user-invocable: false` 메타데이터를 직접 해석하지 않는다.
 * 내부 체인 전용 스킬은 공식 Codex skill policy로 implicit invocation을 막는다.
 */
export declare function applyCodexSkillInvocationPolicies(skillsDir: string): void;
//# sourceMappingURL=fs-utils.d.ts.map