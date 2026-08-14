/** 읽기용 루트 — 존재하는 레거시 경로를 우선 반환, 없으면 `.vibe/` */
export declare function projectVibeRoot(projectDir: string): string;
/** 읽기용 경로 — 레거시 인식 */
export declare function projectVibePath(projectDir: string, ...sub: string[]): string;
/** 쓰기용 경로 — 항상 신규 레이아웃(`.vibe/`) */
export declare function projectVibePathPreferred(projectDir: string, ...sub: string[]): string;
//# sourceMappingURL=vibePaths.d.ts.map