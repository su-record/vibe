/**
 * ProjectSetup - 프로젝트 레벨 설정
 */
import { TechStack, StackDetails } from '../types.js';
/**
 * constitution.md 생성 또는 업데이트
 */
export declare function updateConstitution(coreDir: string, detectedStacks: TechStack[], stackDetails: StackDetails): void;
export declare function adaptToCodex(section: string): string;
/**
 * 전역 ~/.claude/CLAUDE.md 생성/갱신 — vibe 규약(룰·키워드·워크플로) 전역 주입
 */
export declare function generateGlobalClaudeMd(): void;
/**
 * 전역 ~/.codex/AGENTS.md 생성/갱신 (Codex CLI 감지 시에만 호출)
 */
export declare function generateGlobalCodexAgentsMd(): void;
/**
 * 전역 ~/.gemini/GEMINI.md 생성/갱신 (Antigravity CLI context file)
 */
export declare function generateGlobalAntigravityMd(): void;
/**
 * 프로젝트 분석 → CLAUDE.md 생성/갱신 (프로젝트별 섹션만)
 * 전역 규약은 `~/.claude/CLAUDE.md`에서 별도 관리.
 */
export declare function generateProjectClaudeMd(projectRoot: string, detectedStacks: TechStack[], stackDetails: StackDetails, createIfMissing?: boolean): void;
/**
 * 프로젝트 분석 → AGENTS.md 생성/갱신 (Codex 용, 프로젝트별 섹션만)
 * @param createIfMissing false 시 존재하는 파일만 갱신 (update --dynamic 용)
 */
export declare function generateProjectAgentsMd(projectRoot: string, detectedStacks: TechStack[], stackDetails: StackDetails, createIfMissing?: boolean): void;
/**
 * 프로젝트 분석 → GEMINI.md 생성/갱신 (Antigravity context file)
 * @param createIfMissing false 시 존재하는 파일만 갱신
 */
export declare function generateProjectAntigravityMd(projectRoot: string, detectedStacks: TechStack[], stackDetails: StackDetails, createIfMissing?: boolean): void;
/**
 * 전역 VIBE 규약 섹션 (프로젝트 독립) — ~/.claude/CLAUDE.md, ~/.codex/AGENTS.md
 * export 이유: 하네스별 변환 결과를 테스트가 직접 검증한다 (instruction-drift.test.ts).
 */
export declare function buildGlobalSection(language: string): string;
/**
 * 프로젝트 core 폴더 설정
 */
export declare function updateRules(coreDir: string, detectedStacks: TechStack[], isUpdate?: boolean): void;
/**
 * 프로젝트 레벨 훅 설치 (.claude/settings.local.json)
 *
 * @param projectRoot 프로젝트 루트
 * @param harnessDir 하네스 디렉토리 이름 ('.claude', 기본값: '.claude')
 */
/**
 * 설치된 프로젝트 훅이 패키지 템플릿과 어긋났는가.
 *
 * WHY: `repairProjectHooks` 가 **부재**만 봤다 — 훅 키가 있으면 무조건 최신으로
 * 취급했다. 그래서 훅 내용이 바뀌어도(예: PostToolUse matcher 에 `Agent` 추가)
 * 이미 설치한 사용자에게는 **영영 도달하지 않는다**. 실측: v3.2.35 로 upgrade 한
 * 직후에도 `.claude/settings.local.json` 은 옛 matcher 를 그대로 갖고 있었다.
 *
 * 전역 자산은 `staleGlobalAssets` 로 같은 문제를 이미 막았는데 프로젝트 훅에는
 * 그 장치가 없었다. 설치 자체가 idempotent 하므로(아래 installer 는 `hooks` 키만
 * 통째로 교체하고 나머지 설정은 보존한다) 어긋나면 그냥 다시 깔면 된다.
 */
export declare function projectHooksStale(projectRoot: string, harnessDir?: string): boolean;
export declare function installProjectHooks(projectRoot: string, harnessDir?: string): void;
/**
 * Codex notify 설치 — `~/.codex/config.toml` 에 `notify` 프로그램을 등록한다.
 *
 * Codex 는 Claude Code 의 settings.local.json hook 을 읽지 않는다. 대신 lifecycle
 * 이벤트를 `notify` 배열에 등록된 프로그램으로 발화하므로, 이를 vibe 의 codex-notify
 * 어댑터에 연결해 turn 완료 시 auto-commit/devlog 를 돌린다.
 *
 * - 관리 블록(마커)으로 idempotent 갱신
 * - 사용자가 이미 자체 `notify` 키를 둔 경우 덮어쓰지 않고 건너뛴다(경고)
 * - TOML 루트 키는 테이블 헤더 이전에 와야 하므로 관리 블록을 파일 최상단에 둔다
 *
 * @param configDir Codex 설정 디렉토리 (보통 `~/.codex`)
 */
export declare function installCodexNotify(configDir: string): void;
/**
 * .gitignore 업데이트
 *
 * @param harnessDir '.claude' | '.codex' (기본값: '.claude')
 *   하네스-특정 경로(settings.local.json, checkpoints/)는 해당 디렉토리에 쓰기 위해 사용.
 */
export declare function updateGitignore(projectRoot: string, harnessDir?: string): void;
/**
 * config.json 생성/업데이트
 */
export declare function updateConfig(coreDir: string, detectedStacks: TechStack[], stackDetails: StackDetails, isUpdate?: boolean, harnessDir?: string): void;
//# sourceMappingURL=ProjectSetup.d.ts.map