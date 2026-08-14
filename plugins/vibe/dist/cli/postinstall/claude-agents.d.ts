/**
 * Claude Code 네이티브 서브에이전트 변환 및 설치
 *
 * VIBE 에이전트 마크다운 파일을 Claude Code 네이티브 서브에이전트 형식
 * (YAML frontmatter 포함)으로 변환하여 ~/.claude/agents/에 설치
 */
/**
 * VIBE 에이전트를 Claude Code 네이티브 서브에이전트 형식으로 변환
 *
 * export 인 이유: 플러그인 배포 트리(`scripts/build-plugin.ts`)도 같은 변환을 써야
 * 한다. 저장소의 `agents/*.md` 에는 frontmatter 가 없고 — 설치 시점에 여기서
 * 생성된다 — 플러그인은 postinstall 을 거치지 않으므로 빌드 때 미리 굽지 않으면
 * description·model·tools 없이 로드된다(실측: `claude plugin validate` 경고 11건).
 * 변환 로직을 두 벌로 만들면 그 순간부터 갈라진다.
 */
export declare function convertAgentToClaude(content: string, filename: string): string;
export interface InstallClaudeAgentsOptions {
    /** 최상위 디렉토리명 기준 제외 목록 (예: 조건부 그룹 'ui'/'figma'/'event') */
    skipDirs?: ReadonlyArray<string>;
    /** 지정 시 이 최상위 디렉토리들만 설치 (프로젝트 로컬 조건부 설치용) */
    onlyDirs?: ReadonlyArray<string>;
}
/**
 * Claude Code 네이티브 서브에이전트 설치
 *
 * agents/ 디렉토리를 재귀 순회하여 모든 .md 파일을 변환 후 설치.
 * `agents/teams/` 는 단일 sub-agent가 아닌 다중 agent 메타 문서이므로
 * 별도 위치(vibe core)에 보관하며 Claude Code sub-agent로는 등록하지 않는다.
 *
 * options.skipDirs / options.onlyDirs 로 최상위 그룹 디렉토리를 선별한다 —
 * 전역 설치는 조건부 그룹(ui/figma/event)을 제외하고, vibe init/update가
 * 스택·capability 매칭 시 해당 그룹만 프로젝트 로컬에 설치한다.
 */
export declare function installClaudeAgents(agentsSource: string, claudeAgentsDir: string, options?: InstallClaudeAgentsOptions): void;
//# sourceMappingURL=claude-agents.d.ts.map