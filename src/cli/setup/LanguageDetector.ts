/**
 * LanguageDetector - OS 언어 감지 모듈
 * setup.ts에서 추출
 */

import { execSync } from 'child_process';

export type SupportedLanguage = 'ko' | 'en';

/**
 * OS 언어 설정 감지하여 vibe 언어 반환
 * - 한국어 OS → 'ko'
 * - 그 외 → 'en' (기본값)
 */
export function detectOsLanguage(): SupportedLanguage {
  try {
    let locale = '';

    if (process.platform === 'win32') {
      // Windows: PowerShell로 시스템 로캘 확인
      try {
        locale = execSync('powershell -Command "[System.Globalization.CultureInfo]::CurrentCulture.Name"', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch {
        // 대안: LANG 환경변수
        locale = process.env.LANG || process.env.LC_ALL || '';
      }
    } else {
      // macOS/Linux: LANG 환경변수
      locale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
    }

    // 한국어 로캘 감지 (ko-KR, ko_KR, ko 등)
    if (locale.toLowerCase().startsWith('ko')) {
      return 'ko';
    }

    return 'en';
  } catch {
    return 'en';
  }
}

/**
 * 언어에 따른 CLAUDE.md 응답 언어 지시문 생성
 */
export function getLanguageInstruction(language: SupportedLanguage): string {
  return language === 'ko'
    ? '\n\n## Response Language\n\n**IMPORTANT: Always respond in Korean (한국어) unless the user explicitly requests otherwise.**'
    : '\n\n## Response Language\n\n**IMPORTANT: Always respond in English unless the user explicitly requests otherwise.**';
}
