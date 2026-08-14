/**
 * 바인딩이 빠진 네이티브 의존성 목록.
 *
 * 패키지 자체가 없으면 **누락이 아니다** — 설치되지 않은 선택 의존성과
 * 설치됐는데 빌드가 안 된 상태는 다른 사건이다. 후자만 복구 대상이다.
 */
export declare function missingNativeDeps(packageRoot: string): string[];
/**
 * 빠진 바인딩을 내려받아 복구한다.
 *
 * @returns 복구된 것과 실패한 것 — 실패는 숨기지 않는다. 조용히 실패하면
 *          "설치 성공" 이 또 거짓말이 된다.
 */
export declare function repairNativeDeps(packageRoot: string): {
    repaired: string[];
    failed: string[];
};
/**
 * 복구 실패 시 사용자가 직접 쓸 명령 — npm 정책을 푸는 쪽이 근본 처방이다.
 *
 * `npm install-scripts approve` 를 안내하면 안 된다(실측). 그건 승인을 **설치된
 * 패키지 자신의 package.json** 에 쓰는데, 그 파일은 다음 `npm i -g` 가 게시본으로
 * 덮어쓴다 — 업그레이드 한 번이면 승인이 사라진다. 같은 이유로 `allowScripts` 를
 * 우리 package.json 에 담아 게시해도 무의미하다(전역 설치에서 무시됨을 확인).
 *
 * 유일하게 지속되는 형태는 사용자 레벨 npm config 다.
 */
export declare function nativeDepHint(names: string[]): string;
//# sourceMappingURL=NativeDeps.d.ts.map