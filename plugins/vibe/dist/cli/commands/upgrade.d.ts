/**
 * upgrade 명령어 — 전역 패키지 최신 버전으로 업그레이드
 */
import { CliOptions } from '../types.js';
/**
 * Read status formatter from the package that was just installed.
 *
 * WHY: `vibe upgrade` keeps running in the old process after npm install.
 * Loading auth.js from the installed package prevents stale post-upgrade labels.
 */
export declare function readInstalledLLMStatus(globalRoot: string): string;
/**
 * npm 출력에서 postinstall 의 보고성 라인만 뽑는다.
 *
 * WHY: `npm install -g` 를 `stdio: 'pipe'` 로 감싸 npm 노이즈를 숨기는데, 그 과정에서
 * postinstall 이 낸 보고까지 삼켜졌다. 특히 "철회된 스킬 파일을 지웠다" 는 사실이
 * 사라지면 삭제가 조용해진다 — `pruneExtraneousSkillFiles` 가 제거 목록을 반환하도록
 * 만든 이유가 무효화된다.
 *
 * npm 전체 출력을 그대로 흘리지 않는 이유: 진행률·경고가 섞여 업그레이드 결과를 가린다.
 * 접두사 화이트리스트로 vibe 가 의도적으로 낸 라인만 통과시킨다.
 */
export declare function extractPostinstallReport(npmOutput: string): string[];
/**
 * 업그레이드 후 현재 프로젝트의 훅을 복구한다.
 *
 * WHY: postinstall 은 전역 자산(스킬·에이전트·규칙)만 설치하고 훅은 의도적으로
 * 프로젝트 레벨에 남긴다(main.ts "6. hooks는 프로젝트 레벨에서 관리"). 그 결과
 * `vibe upgrade` 만 쓰는 사용자는 스킬은 최신인데 **훅이 영원히 설치되지 않는**
 * 상태가 되고, sentinel-guard·scope-guard·run-ledger·verify 게이트가 전부 죽어
 * 있는데도 "✅ vibe upgraded" 만 보게 된다. loop-contract 의 전제("폭주 방어가
 * 모델의 양심이 아니라 결정론적 가드")가 조용히 무너지는 지점이라, 여기서만큼은
 * 경고가 아니라 복구를 한다.
 *
 * 범위는 훅으로 한정한다 — 스킬·CLAUDE.md 재생성은 `vibe update` 의
 * 몫이고, 전역 명령이 프로젝트 문서를 말없이 바꾸면 놀라움이 더 크다.
 * 훅 파일은 gitignore 된 로컬 설치 아티팩트이고 설치는 idempotent 다.
 *
 * @returns 복구한 하네스 목록 (빈 배열이면 복구 불필요 또는 vibe 프로젝트 아님)
 */
export declare function repairProjectHooks(projectRoot: string): string[];
/**
 * 전역 자산(`~/.vibe/`)이 방금 설치한 버전으로 갱신됐는지 판정한다.
 *
 * postinstall 이 패키지를 `~/.vibe/node_modules/@su-record/vibe` 로 복사하므로,
 * 그 사본의 버전이 **마지막으로 postinstall 이 성공한 시점**을 말해준다.
 *
 * @returns 갱신됐으면 null, 아니면 발견된 사본 버전(없으면 'none')
 */
export declare function staleGlobalAssets(installedVersion: string): string | null;
/**
 * Upgrade global package to latest version
 * npm install -g → postinstall handles global config
 */
export declare function upgrade(_options?: CliOptions): void;
//# sourceMappingURL=upgrade.d.ts.map