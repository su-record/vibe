/**
 * UI/UX 워크플로우 유틸리티
 *
 * /vibe.spec, /vibe.run, /vibe.review에서 UI/UX 에이전트
 * 활성화 여부를 판단하는 헬퍼 함수 모음.
 */
/**
 * SPEC 컨텍스트에 UI/UX 키워드가 포함되어 있는지 감지합니다.
 *
 * @param specContent - SPEC 문서 전체 텍스트
 * @returns UI/UX 프로젝트 여부
 */
export declare function isUiUxProject(specContent: string): boolean;
/**
 * 데이터 시각화 에이전트(⑤) 실행 여부를 판단합니다.
 *
 * @param specContent - SPEC 문서 전체 텍스트
 * @returns 데이터 시각화 관련 키워드 포함 여부
 */
export declare function shouldRunDataViz(specContent: string): boolean;
/**
 * 변경된 파일 중 UI 파일이 존재하는지 확인합니다.
 *
 * @param changedFiles - 변경된 파일 경로 배열
 * @returns UI 파일 포함 여부
 */
export declare function hasUiFileChanges(changedFiles: string[]): boolean;
/**
 * 프로젝트의 디자인 시스템 MASTER.md를 로드합니다.
 *
 * @param projectName - 프로젝트 이름
 * @param projectRoot - 프로젝트 루트 경로 (기본: process.cwd())
 * @returns MASTER.md 내용 또는 null
 */
export declare function loadDesignSystem(projectName: string, projectRoot?: string): string | null;
/**
 * UI/UX 분석 비활성화 여부를 확인합니다.
 *
 * @param projectRoot - 프로젝트 루트 경로 (기본: process.cwd())
 * @returns 비활성화 여부 (true = 비활성화됨)
 */
export declare function isUiUxAnalysisDisabled(projectRoot?: string): boolean;
/**
 * 글로벌 UI/UX 데이터가 설치되어 있는지 확인합니다.
 *
 * @returns 데이터 디렉토리 존재 여부
 */
export declare function isUiUxDataInstalled(): boolean;
/**
 * 페이지별 디자인 오버라이드를 로드합니다.
 *
 * @param projectName - 프로젝트 이름
 * @param page - 페이지 이름 (예: 'dashboard', 'checkout')
 * @param projectRoot - 프로젝트 루트 경로
 * @returns 페이지 오버라이드 내용 또는 null
 */
export declare function loadPageOverride(projectName: string, page: string, projectRoot?: string): string | null;
//# sourceMappingURL=UiUxWorkflow.d.ts.map