/**
 * LanguageDetector - OS 언어 감지 모듈
 */
export type SupportedLanguage = 'ko' | 'en';
/**
 * OS 언어 설정 감지하여 core 언어 반환
 * - 한국어 OS → 'ko'
 * - 그 외 → 'en' (기본값)
 */
export declare function detectOsLanguage(): SupportedLanguage;
/**
 * 언어에 따른 CLAUDE.md 응답 언어 지시문 생성
 */
export declare function getLanguageInstruction(language: SupportedLanguage): string;
//# sourceMappingURL=LanguageDetector.d.ts.map