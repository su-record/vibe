export type AttachmentKind = 'spec' | 'feature' | 'document' | 'image' | 'code' | 'unknown';
export type UrlKind = 'figma' | 'github' | 'youtube' | 'web';
export interface ResumeState {
    /** `.vibe/.last-feature` 에 기록된 직전 feature */
    lastFeature: string | null;
    /** 확인한 feature 이름 (인자 우선, 없으면 lastFeature) */
    feature: string | null;
    specPath: string | null;
    featurePath: string | null;
    /** spec 이 있으면 run 부터, 둘 다 없으면 처음부터 */
    resumeFrom: 'spec' | 'run' | 'none';
    /** 입력 컨텍스트로만 쓰는 구버전 산출물 (재생성 금지) */
    legacyArtifacts: string[];
}
export interface StakesSignals {
    /** `.vibe/config.json` 이 없는 디렉토리 — demo 신호 */
    hasVibeConfig: boolean;
    /** OS 임시 디렉토리 하위 — demo 신호 */
    isTempDir: boolean;
    /** git 저장소 여부 — 기존 프로젝트 코드 위 작업인지 */
    isGitRepo: boolean;
}
export interface DispatchSignals {
    projectRoot: string;
    resume: ResumeState;
    stakes: StakesSignals;
    urls: Array<{
        url: string;
        kind: UrlKind;
    }>;
    attachments: Array<{
        path: string;
        kind: AttachmentKind;
        exists: boolean;
    }>;
}
/**
 * Smart Resume — `/vibe` Phase 2 의 파일 존재 검사를 코드로 확정한다.
 */
export declare function detectResumeState(projectRoot: string, feature?: string): ResumeState;
/**
 * stakes 판정의 **결정론 신호만** 확정한다.
 * 명시 키워드·닫힌 표현 같은 언어 신호는 모델 몫으로 남긴다 (SSOT: loop-contract Stakes 표).
 */
export declare function detectStakesSignals(projectRoot: string): StakesSignals;
/** URL 을 도메인으로 분류한다 — 모델이 문자열을 눈으로 보고 고르지 않도록. */
export declare function classifyUrl(url: string): UrlKind;
/** 첨부 파일을 확장자·경로로 분류한다. */
export declare function classifyAttachment(filePath: string): AttachmentKind;
/**
 * 디스패처가 한 번에 받아가는 신호 묶음.
 *
 * @param projectRoot 프로젝트 루트
 * @param input 사용자 입력에서 뽑은 URL·첨부 경로 (추출 자체는 모델이 한다)
 */
export declare function collectDispatchSignals(projectRoot: string, input?: {
    urls?: string[];
    attachments?: string[];
    feature?: string;
}): DispatchSignals;
//# sourceMappingURL=deterministicSignals.d.ts.map