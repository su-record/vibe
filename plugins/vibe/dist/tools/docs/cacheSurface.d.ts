/**
 * 프리픽스 캐시 표면 문서(`vibe/rules/prefix-cache-surface.md`)의 판정 로직.
 *
 * 문서가 자산을 나열하는 순간 그것은 **두 번째 집**이 된다 — 실물이 움직이면 조용히 어긋난다.
 * dsh 가 정확히 그렇게 무너졌다: 게이트가 걸린 `packages/README.md` 는 50개 전부 맞았고,
 * 게이트 없는 루트 문서의 레이아웃 트리는 존재하지 않는 그룹 2개를 나열하고 17개를 빠뜨렸다.
 * 그래서 나열은 허용하되 **양방향으로** 검사한다: 문서에 없는 실물도, 실물이 없는 문서 항목도 실패다.
 *
 * 파일시스템 수집은 여기서 하지 않는다 — 이 모듈은 순수 함수로 두고
 * `scripts/validate-cache-surface.ts` 가 실물을 모아 넘긴다.
 */
/** 자산 문서라면 반드시 답해야 하는 두 질문 */
export declare const REQUIRED_SUBSECTIONS: readonly ["Model Experience", "KV Cache effect"];
export interface SurfaceSection {
    id: string;
    /** 마커 아래 본문 (다음 마커 직전까지) */
    body: string;
    /** 본문의 표에서 뽑은 백틱 경로 */
    entries: string[];
}
export interface SurfaceFinding {
    code: string;
    message: string;
}
/** 문서를 절 단위로 쪼갠다 */
export declare function parseSurfaceDoc(content: string): SurfaceSection[];
/** 모든 절이 두 질문에 답했는가 */
export declare function checkRequiredSubsections(sections: SurfaceSection[]): SurfaceFinding[];
/**
 * 나열된 절과 실물을 양방향으로 맞춘다.
 *
 * @param sections 문서에서 파싱한 절
 * @param actual   절 id → 실제 존재하는 자산 경로. 여기 없는 절은 집계 절로 보고 건너뛴다
 */
export declare function checkEnumeratedSurfaces(sections: SurfaceSection[], actual: Record<string, readonly string[]>): SurfaceFinding[];
export declare function checkCacheSurfaceDoc(content: string, actual: Record<string, readonly string[]>): SurfaceFinding[];
//# sourceMappingURL=cacheSurface.d.ts.map