/**
 * init 명령어
 */
/**
 * 스택 + capability 기반 로컬 스킬 설치 (.claude/skills/)
 * init, update 공용
 *
 * @param harnessDir '.claude' (기본값: '.claude')
 */
export declare function installLocalSkills(projectRoot: string, stackTypes: string[], capabilities?: string[], harnessDir?: string): void;
/**
 * 스택 + capability 기반 로컬 에이전트 그룹 설치 (.claude/agents/)
 * init, update 공용
 *
 * 조건부 그룹(ui/figma/event)은 전역 postinstall에서 제외되므로,
 * 매칭되는 프로젝트에서만 여기서 로컬 설치된다.
 */
export declare function installLocalAgents(projectRoot: string, stackTypes: string[], capabilities?: string[], harnessDir?: string): void;
/**
 * 감지된 스택에 해당하는 언어 룰 파일을 프로젝트 로컬에 설치
 * 전역 ~/.<harness>/vibe/languages/ (fallback: ~/.claude/vibe/languages/) → 프로젝트 `.vibe/languages/`
 *
 * @param harnessDir 전역 소스 탐색용 하네스. 설치 대상은 항상 `.vibe/`.
 */
export declare function installLanguageRules(projectRoot: string, stackTypes: string[], harnessDir?: string): void;
/**
 * init 명령어 실행
 *
 * @param projectName 새 프로젝트 디렉토리 이름 (생략 시 cwd 사용)
 * @param target 초기화 대상 하네스.
 *   - 'cc'     → `.claude/` + CLAUDE.md (기본)
 *   - 'codex'  → `.codex/`  + AGENTS.md
 *   - 'antigravity' → `.gemini/` + GEMINI.md (Antigravity context file)
 */
export declare function init(projectName?: string, target?: 'cc' | 'codex' | 'antigravity'): Promise<void>;
//# sourceMappingURL=init.d.ts.map