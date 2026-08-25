/**
 * 정보 명령어 (help, status, version)
 */
/**
 * 도움말 표시
 */
export declare function showHelp(): void;
/**
 * 프로젝트 훅 설치 상태 — 하네스별 한 줄 요약.
 *
 * WHY: 훅이 없으면 sentinel-guard·scope-guard·run-ledger·verify 게이트가 전부
 * 조용히 죽는다. 그런데 `vibe upgrade` 는 전역 자산만 갱신하므로 upgrade 만 쓰는
 * 사용자는 이 상태에 도달하고도 알 방법이 없었다. 상태 화면이 결정론적 가드의
 * 생사를 보여주지 않으면 loop-contract 의 전제를 검증할 수단이 없다.
 */
export declare function formatHookStatus(projectRoot: string, 
/** Codex CLI 설치 여부 — 생략하면 감지한다. 테스트가 머신 상태에 좌우되지 않도록 주입 가능. */
codexInstalled?: boolean): string;
/**
 * 네이티브 바인딩 상태 — 빠져 있으면 메모리·RAG 가 매 훅마다 조용히 죽는다.
 *
 * npm 12 의 `allowScripts` 가 install 스크립트를 차단하면 설치는 성공하는데
 * 바인딩만 없는 상태가 된다. 상태 화면이 이걸 보여주지 않으면 사용자는
 * "설치는 됐는데 메모리가 안 붙는다" 를 진단할 방법이 없다.
 */
export declare function formatNativeDepStatus(packageRoot: string): string;
/**
 * 전역 스킬 디렉토리의 구성 — **상시 컨텍스트 비용**을 보이게 한다.
 *
 * WHY: 스킬은 하나하나가 매 세션 컨텍스트에 얹힌다. 그런데 늘어나는 경로가 셋인데
 * 어느 것도 보고되지 않았다 — vibe 자신, `vibe init` 이 스택에 맞춰 **자동 설치**하는
 * 외부 스킬(실측: `vercel-labs/agent-skills` 한 패키지가 스킬 9개), 그리고 개명 뒤
 * 남은 vibe 잔재. 사용자는 `vibe init` 한 번에 스킬이 몇 개 늘었는지 알 방법이 없었다.
 *
 * 잔재는 **보고만** 한다 — 자동 삭제하지 않는다. `docs`·`test` 같은 일반적인 이름이
 * 섞여 있어 사용자가 만든 동명 스킬을 지울 위험이 실재하고, 애매할 때 지우는 쪽이
 * 훨씬 나쁘다. 무엇이 있는지 보여주면 판단은 사람이 한다.
 */
export declare function formatSkillStatus(globalSkillsDir: string, shippedSkillsDir: string): string;
/**
 * 설치된 스킬이 배송본과 같은가.
 *
 * WHY: `vibe status` 는 스킬 **개수**만 셌다. 개수가 같아도 내용은 다를 수 있다 —
 * 중단된 postinstall, 부분 복사, 사용자가 고친 파일. 이 저장소가 반복해서 겪은
 * 실패가 전부 "설치본이 조용히 어긋났고 확인할 기준값이 없었다" 였다.
 *
 * ## 왜 해시 잠금 파일이 아니라 배송본 직접 대조인가
 *
 * 설치 시 postinstall 이 `{{VIBE_PATH_URL}}`·`{{VIBE_PATH}}` 를 실제 경로로 치환한다
 * (`fs-utils.ts` replaceTemplatesInDir). 그래서 날것 비교는 치환된 스킬을 전부
 * 드리프트로 잡는다(실측 29개 중 11개 오탐).
 *
 * 그렇다고 **역치환은 불가능하다** — 소스의 `file://{{VIBE_PATH}}` 와
 * `{{VIBE_PATH_URL}}` 이 **같은 문자열**(`file:///…`)로 치환되므로 되돌릴 때
 * 어느 쪽이었는지 알 수 없다(실측으로 `process-steps.md` 가 여기 걸렸다).
 *
 * 방향을 뒤집으면 모호함이 사라진다: 배송본에 **같은 치환을 적용해** 기대값을 만들고
 * 설치본과 비교한다. 그리고 배송본은 항상 곁에 있다 — CLI 가 그 안에서 돈다.
 * 별도 잠금 파일이 필요 없는 이유다.
 *
 * @returns 어긋난 스킬 이름들 (배송본을 못 읽으면 null — 판정하지 않는다)
 */
export declare function driftedSkills(installedDir: string, shippedSkillsDir: string, corePath?: string): string[] | null;
/**
 * 상태 표시 — 모든 시스템 상태를 한 곳에서 확인
 */
export declare function showStatus(): void;
/**
 * 버전 표시
 */
export declare function showVersion(): void;
//# sourceMappingURL=info.d.ts.map