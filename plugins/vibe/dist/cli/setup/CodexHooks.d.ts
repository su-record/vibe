interface CodexHookCommand {
    type: 'command';
    command: string;
}
interface CodexHookEntry {
    hooks: CodexHookCommand[];
}
export interface CodexHooksConfig {
    hooks: {
        SessionStart: CodexHookEntry[];
        UserPromptSubmit: CodexHookEntry[];
        PreToolUse: CodexHookEntry[];
        PostToolUse: CodexHookEntry[];
        Stop: CodexHookEntry[];
        /** CC 의 context_window_* Notification 등가물 — Codex 에는 임계치 알림이 없다 */
        PreCompact: CodexHookEntry[];
        PostCompact: CodexHookEntry[];
    };
}
export declare function buildCodexHooksConfig(coreDir?: string): CodexHooksConfig;
/**
 * 설치된 Codex 프로젝트 훅이 현재 정의와 어긋났는가.
 *
 * WHY: `repairProjectHooks` 의 Codex 분기가 **부재만** 봤다 — 파일이 있으면 무조건
 * 최신으로 취급했다. 그래서 훅 정의가 바뀌어도 이미 설치한 사용자에게는 **영영
 * 도달하지 않는다**. 실측(v3.2.59): `PostCompact` 가 추가된 뒤 upgrade 해도 설치본은
 * `PreCompact` 까지만 갖고 있었고, 파일을 지운 뒤 재실행해야 복구됐다.
 *
 * `.claude` 쪽은 `projectHooksStale` 이 같은 문제를 이미 막았다 — 이 함수는 그 판정을
 * Codex 로 옮긴 것이고 안전 규약도 같다: 부재는 stale 이 아니라 미설치(호출부가 따로
 * 본다), 판독 불가도 stale 이 아니다(사용자 설정을 함부로 덮지 않는다).
 *
 * 기대값을 파일 템플릿이 아니라 `buildCodexHooksConfig` 에서 얻는 이유: 설치가 쓰는
 * 것과 **같은 출처**여야 판정과 설치가 갈라지지 않는다.
 */
export declare function codexHooksStale(projectRoot: string, coreDir?: string): boolean;
export declare function installProjectCodexHooks(projectRoot: string, coreDir?: string): void;
export {};
//# sourceMappingURL=CodexHooks.d.ts.map