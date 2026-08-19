/**
 * 상수 데이터
 */
/**
 * 전역 설치 스킬 (postinstall → ~/.claude/skills/) — 공개 분류
 * 내부 core 동작은 관련 공개 스킬 본문에 통합하며 별도 discovery 항목으로 설치하지 않는다.
 */
/**
 * 도트 진입점 스킬 (예: vibe.spec)
 * Claude Code에서는 slash-style 진입점으로, Codex에서는 `/skills` 또는 `$vibe.spec`로 호출된다.
 */
export declare const GLOBAL_SKILLS_ENTRY: ReadonlyArray<string>;
export declare const GLOBAL_SKILLS_STANDARD: ReadonlyArray<string>;
/** 전역 설치에서 제외된 스킬 (명시적 /skill-name 호출 시에만 활성)
 *  사유: 표준 도구 래퍼이거나 구체성 부족 — 직접 프롬프트가 더 효과적 */
export declare const GLOBAL_SKILLS_OPTIONAL: ReadonlyArray<string>;
/** 전역 설치 스킬 전체 (하위 호환용) */
export declare const GLOBAL_SKILLS: ReadonlyArray<string>;
/** 스택 → 로컬 스킬 매핑 (vibe init/update → .claude/skills/) */
export declare const STACK_TO_SKILLS: Record<string, ReadonlyArray<string>>;
/** Capability → 로컬 스킬 매핑 (의존성 감지 기반 자동 설치) */
export declare const CAPABILITY_SKILLS: Record<string, ReadonlyArray<string>>;
/** 스택 → 외부 스킬(skills.sh) 매핑 (vibe init/update → npx skills add) */
export declare const STACK_TO_EXTERNAL_SKILLS: Record<string, ReadonlyArray<string>>;
/**
 * Capability → 외부 스킬(skills.sh) 매핑.
 *
 * vibe 가 직접 쓰지 않고 생태계 스킬로 넘기는 영역을 여기에 둔다. MCP 서버 저작이
 * 그런 경우다 — vibe 는 검증 하네스지 MCP 저작 도구가 아니고, 이미 잘 관리되는
 * 1차 출처(`anthropics/skills`)가 있다. 없는 것을 새로 쓰는 것보다 있는 것을
 * 가리키는 쪽이 유지보수가 적다.
 *
 * 여기 올리는 것은 **opt-in capability 에 한한다** — 스택 매핑과 달리 사용자가
 * `vibe init` 에서 명시적으로 고른 경우에만 설치된다. 스킬은 상시 컨텍스트 비용이라
 * (`vibe status` 의 Skills 행 참조) 묻지 않고 얹지 않는다.
 */
export declare const CAPABILITY_EXTERNAL_SKILLS: Record<string, ReadonlyArray<string>>;
/** 사용자 선택 가능한 capability 목록 (vibe init 인터랙티브 프롬프트용) */
export declare const AVAILABLE_CAPABILITIES: ReadonlyArray<{
    value: string;
    label: string;
    hint: string;
}>;
/**
 * 스택 타입 + capabilities → 로컬 설치할 스킬 목록 결정
 */
export declare function resolveLocalSkills(stackTypes: string[], capabilities?: string[]): string[];
/**
 * 스택 타입 + capabilities → 외부 스킬(skills.sh) 목록 결정
 */
export declare function resolveExternalSkills(stackTypes: string[], capabilities?: string[]): string[];
/**
 * 조건부 에이전트 그룹 — 전역 postinstall에서 제외하고,
 * vibe init/update 시 스택/capability 매칭될 때만 프로젝트 로컬(.claude/agents/)에 설치.
 *
 * WHY: 에이전트 description은 매 턴 Agent tool schema에 열거되어 상시 컨텍스트를
 * 점유한다. UI/Figma/Event 에이전트(18개)는 해당 스택·capability 프로젝트에서만
 * 의미가 있으므로 전역에서 빼면 비해당 프로젝트의 세션당 수백 토큰이 절약된다.
 */
export declare const CONDITIONAL_AGENT_GROUPS: ReadonlyArray<string>;
/** 스택 → 에이전트 그룹 매핑 (vibe init/update → .claude/agents/) */
export declare const STACK_TO_AGENT_GROUPS: Record<string, ReadonlyArray<string>>;
/** capability → 에이전트 그룹 매핑 */
export declare const CAPABILITY_AGENT_GROUPS: Record<string, ReadonlyArray<string>>;
/**
 * 제거된 조건부 에이전트 그룹 — 프로젝트 로컬(.claude/agents/)에 남은 잔여 디렉토리 정리.
 * vibe init/update 시 `removeLegacySkills`(범용 디렉토리 삭제)로 정리한다.
 * (B6: figma 그룹 — 그룹 내 유일했던 에이전트 삭제로 그룹 자체 폐지)
 */
export declare const LEGACY_AGENT_GROUPS: ReadonlyArray<string>;
/**
 * 스택 타입 + capabilities → 로컬 설치할 에이전트 그룹 결정
 * (resolveLocalSkills와 동일한 exact + prefix 매칭 규칙)
 */
export declare function resolveLocalAgentGroups(stackTypes: string[], capabilities?: string[]): string[];
export declare const STACK_TO_LANGUAGE_FILE: Record<string, string>;
export declare const LANGUAGE_GLOBS: Record<string, string>;
export declare const LANGUAGE_RULE_PREFIXES: string[];
export declare const LEGACY_RULE_FILES: string[];
/** v3.2 namespace 통합 — 설치된 bare 스킬을 배송본과 일치할 때만 제거한다. */
export declare const LEGACY_SKILL_RENAMES: Readonly<Record<string, string>>;
/** v3.2에서 배송했던 bare SKILL.md의 SHA-256. 정확히 일치하는 설치본만 정리한다. */
export declare const LEGACY_SKILL_HASHES: Readonly<Record<string, string>>;
/** 이전 네이밍에서 변경된 스킬 — postinstall 시 구 디렉토리 삭제 */
export declare const LEGACY_SKILL_DIRS: ReadonlyArray<string>;
export declare const CLAUDE_MODEL_MAPPING: Record<string, string>;
export declare const CLAUDE_AGENT_TOOLS: Record<string, string[]>;
export declare const CLAUDE_AGENT_TOOL_CATEGORY: Record<string, string>;
export declare const CLAUDE_AGENT_PERMISSION_MODE: Record<string, string>;
export declare const CLAUDE_AGENT_DISALLOWED_TOOLS: Record<string, string[]>;
export declare const CLAUDE_AGENT_MEMORY: Record<string, string>;
/**
 * vibe 가 **과거에 배송했다가 더 이상 배송하지 않는** 스킬 이름.
 *
 * 출처: `git log --diff-filter=D -- 'skills/*'` — `skills/<name>/SKILL.md` 가 이력에서
 * 삭제된 이름들이다(대부분 `vibe.*` 네임스페이스 도입 때 개명됐다).
 *
 * WHY 이 목록이 필요한가: 설치본 소유 판정이 **현재 배송 목록 포함 여부**로 되어 있어,
 * 개명된 스킬은 영원히 "vibe 것이 아님" 으로 분류된다. 그래서 `~/.claude/skills/clone`
 * 같은 잔재가 지워지지도 보고되지도 않은 채 **매 세션 상시 컨텍스트로 로드된다**
 * (실측: 이 저장소 개발 머신에 clone·figma·test 3개가 남아 있었다).
 *
 * 자동 삭제는 하지 않는다 — `docs`·`plan`·`test` 처럼 일반적인 이름이 섞여 있어
 * 사용자가 만든 동명 스킬을 지울 위험이 실재한다. 보고만 하고 판단은 사람이 한다.
 */
export declare const RETIRED_SKILL_NAMES: ReadonlySet<string>;
//# sourceMappingURL=constants.d.ts.map